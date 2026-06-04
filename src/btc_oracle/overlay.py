import math
from dataclasses import dataclass
from statistics import NormalDist
from .types import HORIZONS, BaselineForecast

DRIFT_CAP_BPS = {"1w": 50.0, "1m": 150.0, "1y": 100.0}   # spec §14 #6
VOL_MULT_BOUNDS = (0.8, 1.5)
PUP_BOUNDS = (0.30, 0.70)
_VALID_CONF = {"low", "medium", "high"}


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


def parse_and_clamp(payload) -> dict:
    """Validate the LLM's adjustment JSON and hard-clamp every knob (spec §2b).
    Raises ValueError on malformed input (caller falls back to baseline)."""
    if not isinstance(payload, dict):
        raise ValueError("adjustment must be a dict")
    horizons = payload.get("horizons")
    if not isinstance(horizons, dict):
        raise ValueError("missing 'horizons'")
    out = {}
    for h in HORIZONS:                       # require all three horizons
        if h not in horizons or not isinstance(horizons[h], dict):
            raise ValueError(f"missing horizon {h}")
        a = horizons[h]
        cap = DRIFT_CAP_BPS[h]
        drift = _clamp(float(a.get("drift_adj_bps", 0.0)), -cap, cap)
        vol_mult = _clamp(float(a.get("vol_mult", 1.0)), *VOL_MULT_BOUNDS)
        override = a.get("p_up_override", None)
        if override is not None:
            override = float(override)
            if not (PUP_BOUNDS[0] <= override <= PUP_BOUNDS[1]):
                override = None              # reject implausible directional calls
        conf = a.get("confidence", "low")
        if conf not in _VALID_CONF:
            conf = "low"
        out[h] = {"drift_adj_bps": drift, "vol_mult": vol_mult,
                  "p_up_override": override, "confidence": conf}
    return {"horizons": out,
            "rationale": str(payload.get("rationale", "")),
            "event_refs": list(payload.get("event_refs", []))}


_ND = NormalDist()


@dataclass(frozen=True)
class EnrichedForecast:
    horizon: str
    horizon_days: int
    spot: float
    central: float
    lower: float
    upper: float
    conf_level: float
    p_up: float
    mu_h: float
    sigma_h: float
    confidence_label: str
    band_width_pct: float
    vol_model: str
    vol_window: int
    baseline_central: float
    baseline_p_up: float
    baseline_sigma_h: float
    drift_adj_bps: float
    vol_mult: float
    skew_adj: float
    llm_applied: bool


def apply_overlay(baseline: BaselineForecast, adj: dict, llm_applied: bool) -> EnrichedForecast:
    """Apply a single clamped horizon adjustment to a baseline forecast.
    The overlay tunes drift + vol only; the predictive band stays symmetric. Skew
    is NOT modeled, so we no longer ask the LLM for it (that was a dead knob); the
    skew_adj field is kept at 0.0 purely for schema/back-compat."""
    mu2 = baseline.mu_h + float(adj["drift_adj_bps"]) / 10_000.0
    sigma2 = baseline.sigma_h * float(adj["vol_mult"])
    central = baseline.spot * math.exp(mu2)
    z = _ND.inv_cdf((1 + baseline.conf_level) / 2)
    lower = baseline.spot * math.exp(mu2 - z * sigma2)
    upper = baseline.spot * math.exp(mu2 + z * sigma2)
    p_up = _ND.cdf(mu2 / sigma2) if sigma2 > 0 else 0.5
    override = adj.get("p_up_override")
    if override is not None:
        p_up = float(override)
    p_up = max(PUP_BOUNDS[0], min(PUP_BOUNDS[1], p_up))
    return EnrichedForecast(
        horizon=baseline.horizon, horizon_days=baseline.horizon_days, spot=baseline.spot,
        central=central, lower=lower, upper=upper, conf_level=baseline.conf_level, p_up=p_up,
        mu_h=mu2, sigma_h=sigma2, confidence_label=adj.get("confidence", "low"),
        band_width_pct=(upper - lower) / baseline.spot,
        vol_model=baseline.vol_model, vol_window=baseline.vol_window,
        baseline_central=baseline.central, baseline_p_up=baseline.p_up,
        baseline_sigma_h=baseline.sigma_h,
        drift_adj_bps=float(adj["drift_adj_bps"]), vol_mult=float(adj["vol_mult"]),
        skew_adj=0.0, llm_applied=llm_applied,
    )


import json as _json

_NEUTRAL = {"drift_adj_bps": 0.0, "vol_mult": 1.0,
            "p_up_override": None, "confidence": "low"}
_FALLBACK_RATIONALE = "Baseline only — LLM adjustment unavailable this run."


def _extract_json(text: str) -> str:
    """Pull the JSON object out of an LLM response that may be wrapped in
    markdown code fences (```json ... ```) or surrounded by prose. Real Claude
    output is usually clean, but this makes the overlay robust so a stray fence
    never silently demotes a good response to the baseline fallback."""
    if not isinstance(text, str):
        raise ValueError("LLM response was not text")
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no JSON object found in LLM response")
    return text[start:end + 1]


def run_overlay(baselines, condensed_events, claude_call):
    """Call the (injected) Claude function, clamp + apply its adjustment, and
    fall back to the untouched baseline on ANY failure. Returns
    (list[EnrichedForecast], rationale, llm_applied)."""
    from .llm import SYSTEM_PROMPT, build_user_prompt  # local import: avoids needing the SDK in math tests
    try:
        raw = claude_call(SYSTEM_PROMPT, build_user_prompt(baselines, condensed_events))
        adj = parse_and_clamp(_json.loads(_extract_json(raw)))
        forecasts = [apply_overlay(b, adj["horizons"][b.horizon], llm_applied=True) for b in baselines]
        return forecasts, adj["rationale"] or "", True
    except Exception:
        forecasts = [apply_overlay(b, dict(_NEUTRAL), llm_applied=False) for b in baselines]
        return forecasts, _FALLBACK_RATIONALE, False

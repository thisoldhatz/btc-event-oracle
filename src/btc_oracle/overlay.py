from .types import HORIZONS

DRIFT_CAP_BPS = {"1w": 50.0, "1m": 150.0, "1y": 100.0}   # spec §14 #6
VOL_MULT_BOUNDS = (0.8, 1.5)
PUP_BOUNDS = (0.30, 0.70)
SKEW_BOUNDS = (-0.2, 0.2)
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
        skew = _clamp(float(a.get("skew_adj", 0.0)), *SKEW_BOUNDS)
        override = a.get("p_up_override", None)
        if override is not None:
            override = float(override)
            if not (PUP_BOUNDS[0] <= override <= PUP_BOUNDS[1]):
                override = None              # reject implausible directional calls
        conf = a.get("confidence", "low")
        if conf not in _VALID_CONF:
            conf = "low"
        out[h] = {"drift_adj_bps": drift, "vol_mult": vol_mult, "skew_adj": skew,
                  "p_up_override": override, "confidence": conf}
    return {"horizons": out,
            "rationale": str(payload.get("rationale", "")),
            "event_refs": list(payload.get("event_refs", []))}

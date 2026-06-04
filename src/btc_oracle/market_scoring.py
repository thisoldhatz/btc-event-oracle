"""Head-to-head scoring of the model vs real-money markets (Polymarket BTC
threshold markets). On capture we store both the market's implied probability and
OUR model's implied probability for the same event (computed from the nearest-
horizon predictive Normal, sqrt-time-scaled to the market's resolution date). On
maturity we Brier-score both against the realized outcome — an honest, like-for-
like comparison: a real-money crowd usually wins at short horizons, and showing
that is the point."""
import hashlib
import math
import re
from datetime import datetime, timezone
from statistics import NormalDist

from .store import (insert_market_once, get_unresolved_markets, resolve_market,
                    get_close_on_or_after)

_ND = NormalDist()
_NUM = re.compile(r"\$\s*([0-9][0-9,]*\.?[0-9]*)\s*([kKmM]?)")
_BELOW = ("below", "under", "dip", "drop", "less than", "fall", "beneath", "≤", "<")
_ABOVE = ("above", "over", "exceed", "reach", "hit", "at least", "more than", "surpass", "≥", ">")


def parse_market(question: str):
    """Extract (threshold, direction) from a BTC threshold question, or (None, None)
    when no plausible price threshold is parseable."""
    if not question:
        return None, None
    m = _NUM.search(question)
    if not m:
        return None, None
    raw = float(m.group(1).replace(",", ""))
    suffix = m.group(2).lower()
    if suffix == "k":
        raw *= 1_000
    elif suffix == "m":
        raw *= 1_000_000
    if raw < 1_000:  # not a plausible BTC price threshold
        return None, None
    q = question.lower()
    direction = "below" if any(k in q for k in _BELOW) else "above"
    return raw, direction


def model_implied_prob(threshold, direction, spot, mu_h, sigma_h, horizon_days, days_to_end):
    """Our P(market event) from the nearest-horizon predictive Normal on the
    log-return, sqrt-time-scaled to the market's own horizon."""
    if not (spot and spot > 0 and threshold and threshold > 0 and sigma_h and sigma_h > 0):
        return None
    scale = max(days_to_end, 0.5) / max(horizon_days, 0.5)
    mu = (mu_h or 0.0) * scale
    sigma = sigma_h * math.sqrt(scale)
    z = (math.log(threshold / spot) - mu) / sigma
    p_above = 1.0 - _ND.cdf(z)
    return p_above if direction == "above" else (1.0 - p_above)


def market_key(question: str, end_date: str) -> str:
    return hashlib.sha1(f"{question}|{end_date}".encode()).hexdigest()[:16]


def _to_utc(s: str) -> datetime:
    d = datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _days_until(end_iso: str, now_iso: str) -> float:
    return (_to_utc(end_iso) - _to_utc(now_iso)).total_seconds() / 86400.0


def _nearest_forecast(forecasts, days_to_end):
    return min(forecasts, key=lambda f: abs(getattr(f, "horizon_days", 7) - days_to_end))


def capture_markets(conn, markets, forecasts, spot, now_iso) -> int:
    """Persist each parseable, still-open market's at-issue market & model
    probabilities (once per market). Fully fail-soft."""
    n = 0
    for mk in markets or []:
        try:
            end_date = mk.get("end_date")
            threshold, direction = parse_market(mk.get("question", ""))
            if not end_date or threshold is None or not forecasts:
                continue
            d = _days_until(end_date, now_iso)
            if d <= 0:
                continue
            f = _nearest_forecast(forecasts, d)
            model_prob = model_implied_prob(
                threshold, direction, spot, getattr(f, "mu_h", None),
                getattr(f, "sigma_h", None), getattr(f, "horizon_days", 7), d)
            if model_prob is None:
                continue
            if insert_market_once(conn, {
                "market_id": market_key(mk["question"], end_date), "captured_at": now_iso,
                "question": mk["question"], "threshold": threshold, "direction": direction,
                "end_date": end_date, "market_prob": mk.get("yes_prob"),
                "model_prob": model_prob, "spot_at_capture": spot,
            }):
                n += 1
        except Exception:  # noqa: BLE001 - never let a market break the run
            continue
    return n


def resolve_markets(conn, now_iso, source="coinbase", interval="1d") -> list:
    """Score every matured-but-unresolved market whose realized price is available."""
    out = []
    for row in get_unresolved_markets(conn, now_iso):
        realized = get_close_on_or_after(conn, source, interval, _to_utc(row["end_date"]).timestamp())
        if realized is None:
            continue
        if row["direction"] == "below":
            outcome = 1 if realized < row["threshold"] else 0
        else:
            outcome = 1 if realized > row["threshold"] else 0
        mp, modp = row["market_prob"], row["model_prob"]
        market_brier = (mp - outcome) ** 2 if mp is not None else None
        model_brier = (modp - outcome) ** 2 if modp is not None else None
        resolve_market(conn, row["market_id"], outcome=outcome, realized=realized,
                       market_brier=market_brier, model_brier=model_brier, resolved_at=now_iso)
        out.append({"market_id": row["market_id"], "outcome": outcome,
                    "market_brier": market_brier, "model_brier": model_brier})
    return out

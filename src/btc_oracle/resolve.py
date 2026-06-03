# src/btc_oracle/resolve.py
from datetime import datetime, timezone
from .scoring import score_forecast
from .store import (get_unresolved_matured, get_close_on_or_after, insert_score, mark_resolved)


def _iso_to_epoch(iso: str) -> float:
    dt = datetime.fromisoformat(iso)
    if dt.tzinfo is None:                    # treat naive timestamps as UTC, not local
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def resolve_matured(conn, now_iso: str, source: str = "coinbase", interval: str = "1d") -> list:
    """Score every matured-but-unresolved forecast whose realized price is available.
    Forecasts whose target date has no price in history yet are left for a later run."""
    resolved = []
    for row in get_unresolved_matured(conn, now_iso):
        realized = get_close_on_or_after(conn, source, interval, _iso_to_epoch(row["target_at"]))
        if realized is None:
            continue
        s = score_forecast(p_up=row["p_up"], central=row["central"], lower=row["lower"],
                           upper=row["upper"], spot_at_issue=row["spot_at_issue"],
                           realized=realized)
        s.update({"forecast_id": row["forecast_id"], "horizon": row["horizon"],
                  "resolved_at": now_iso, "realized_price": realized})
        insert_score(conn, s)
        mark_resolved(conn, row["forecast_id"])
        resolved.append(s)
    return resolved

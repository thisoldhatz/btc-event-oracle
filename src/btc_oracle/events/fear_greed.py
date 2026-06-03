# src/btc_oracle/events/fear_greed.py
from .base import Event, iso_from_epoch

URL = "https://api.alternative.me/fng/"


def parse(payload: dict) -> Event | None:
    data = payload.get("data") or []
    if not data:
        return None
    cur = float(data[0]["value"])
    label = data[0].get("value_classification", "")
    prior = float(data[1]["value"]) if len(data) > 1 else cur
    delta = cur - prior
    interp = f"Fear & Greed {cur:.0f}/100 ({label}), {delta:+.0f} vs prior reading"
    return Event(
        source="fng", signal="fear_greed", value=cur, delta=delta,
        interpretation=interp, observed_at=iso_from_epoch(data[0]["timestamp"]),
        sentiment=label, raw=data[0],
    )


def fetch(http_get) -> list[Event]:
    payload = http_get(URL, {"limit": 2}, {})
    e = parse(payload)
    return [e] if e else []

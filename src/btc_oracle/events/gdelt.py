# src/btc_oracle/events/gdelt.py
from .base import Event, iso_from_gdelt

URL = "https://api.gdeltproject.org/api/v2/doc/doc"
_UA = {"User-Agent": "Mozilla/5.0 btc-oracle"}


def parse_timeline(payload: dict, signal: str) -> Event | None:
    tl = payload.get("timeline") or []
    if not tl:
        return None
    data = tl[0].get("data") or []
    if not data:
        return None
    latest = data[-1]
    cur = float(latest["value"])
    prior = [float(p["value"]) for p in data[:-1]]
    avg = sum(prior) / len(prior) if prior else cur
    delta = cur - avg
    mood = "more positive" if delta > 0 else "more negative"
    interp = f"News tone {cur:+.2f} ({mood} than 3-day avg {avg:+.2f})"
    return Event(
        source="gdelt", signal=signal, value=cur, delta=delta,
        interpretation=interp, observed_at=iso_from_gdelt(latest["date"]), raw=latest,
    )


def fetch_tone(http_get) -> list[Event]:
    params = {"query": "bitcoin", "mode": "timelinetone", "format": "json", "timespan": "3d"}
    payload = http_get(URL, params, _UA)
    e = parse_timeline(payload, "news_tone")
    return [e] if e else []

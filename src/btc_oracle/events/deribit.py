from .base import Event, iso_from_ms

URL = "https://www.deribit.com/api/v2/public/get_volatility_index_data"


def parse_dvol(payload: dict) -> Event | None:
    data = (payload.get("result") or {}).get("data") or []
    if not data:
        return None
    latest = data[-1]                 # [ts_ms, open, high, low, close]
    close = float(latest[4])
    prev = float(data[-2][4]) if len(data) > 1 else close
    delta = close - prev
    mood = "rising (more fear/uncertainty)" if delta > 0 else "falling (calmer)"
    return Event(
        source="dvol", signal="implied_vol", value=close, delta=delta,
        interpretation=f"Deribit implied vol (DVOL) {close:.1f}% annualized, {mood}",
        observed_at=iso_from_ms(latest[0]), raw={"row": latest},
    )


def fetch(http_get, hours: int = 48) -> list[Event]:
    # request a recent hourly window; rely on Deribit returning the most recent
    # points when resolution is fixed. We pass a generous span via start/end;
    # Deribit clamps the returned window to its own limit.
    params = {"currency": "BTC", "resolution": 3600,
              "start_timestamp": 1, "end_timestamp": 9999999999999}
    e = parse_dvol(http_get(URL, params, {}))
    return [e] if e else []

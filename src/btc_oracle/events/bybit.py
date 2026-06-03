# src/btc_oracle/events/bybit.py
from .base import Event, iso_from_ms

BASE = "https://api.bybit.com"
FUNDING_URL = BASE + "/v5/market/funding/history"
OI_URL = BASE + "/v5/market/open-interest"


def _first(payload: dict) -> dict | None:
    lst = (payload.get("result") or {}).get("list") or []
    return lst[0] if lst else None


def parse_funding(payload: dict) -> Event | None:
    row = _first(payload)
    if not row:
        return None
    rate = float(row["fundingRate"])
    side = "longs pay shorts (crowded long)" if rate > 0 else "shorts pay longs (crowded short)"
    interp = f"Perp funding {rate * 100:+.4f}% — {side}"
    return Event(
        source="funding", signal="funding_rate", value=rate, delta=None,
        interpretation=interp, observed_at=iso_from_ms(row["fundingRateTimestamp"]), raw=row,
    )


def parse_oi(payload: dict) -> Event | None:
    row = _first(payload)
    if not row:
        return None
    oi = float(row["openInterest"])
    interp = f"BTC perp open interest {oi:,.0f} contracts"
    return Event(
        source="oi", signal="open_interest", value=oi, delta=None,
        interpretation=interp, observed_at=iso_from_ms(row["timestamp"]), raw=row,
    )


def fetch(http_get) -> list[Event]:
    common = {"category": "linear", "symbol": "BTCUSDT"}
    funding = parse_funding(http_get(FUNDING_URL, {**common, "limit": 2}, {}))
    oi = parse_oi(http_get(OI_URL, {**common, "intervalTime": "1h", "limit": 2}, {}))
    return [e for e in (funding, oi) if e]

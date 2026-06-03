"""OKX perp funding-rate + open-interest adapter. Cloud-friendly (works from
data-center IPs, unlike Bybit which blocks them) and returns the same Event
shape as the Bybit adapter so the dashboard renders it identically."""
from .base import Event, iso_from_ms

BASE = "https://www.okx.com"
FUNDING_URL = BASE + "/api/v5/public/funding-rate"
OI_URL = BASE + "/api/v5/public/open-interest"
INST = "BTC-USD-SWAP"


def _first(payload: dict) -> dict | None:
    data = payload.get("data") or []
    return data[0] if data else None


def parse_funding(payload: dict) -> Event | None:
    row = _first(payload)
    if not row:
        return None
    rate = float(row["fundingRate"])
    side = "longs pay shorts (crowded long)" if rate > 0 else "shorts pay longs (crowded short)"
    ts = row.get("fundingTime")
    return Event(
        source="funding", signal="funding_rate", value=rate, delta=None,
        interpretation=f"Perp funding {rate * 100:+.4f}% — {side}",
        observed_at=iso_from_ms(ts) if ts else "", raw=row,
    )


def parse_oi(payload: dict) -> Event | None:
    row = _first(payload)
    if not row:
        return None
    oi = float(row.get("oiCcy") or row.get("oi") or 0)
    ts = row.get("ts")
    return Event(
        source="oi", signal="open_interest", value=oi, delta=None,
        interpretation=f"BTC perp open interest {oi:,.0f} BTC",
        observed_at=iso_from_ms(ts) if ts else "", raw=row,
    )


def fetch(http_get) -> list[Event]:
    common = {"instId": INST}
    funding = parse_funding(http_get(FUNDING_URL, common, {}))
    oi = parse_oi(http_get(OI_URL, common, {}))
    return [e for e in (funding, oi) if e]

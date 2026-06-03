# tests/events/test_bybit.py
from btc_oracle.events.bybit import parse_funding, parse_oi, fetch

FUNDING = {"result": {"list": [
    {"symbol": "BTCUSDT", "fundingRate": "0.0000814", "fundingRateTimestamp": "1780502400000"},
]}}
OI = {"result": {"list": [
    {"openInterest": "59742.954", "timestamp": "1780509600000"},
]}}


def test_parse_funding_positive_is_crowded_long():
    e = parse_funding(FUNDING)
    assert e.source == "funding"
    assert abs(e.value - 0.0000814) < 1e-12
    assert "long" in e.interpretation.lower()
    assert e.observed_at.startswith("2026-")


def test_parse_oi_reads_open_interest():
    e = parse_oi(OI)
    assert e.source == "oi"
    assert abs(e.value - 59742.954) < 1e-6


def test_parse_empty_returns_none():
    assert parse_funding({"result": {"list": []}}) is None
    assert parse_oi({"result": {}}) is None


def test_fetch_returns_both_signals():
    def fake_get(url, params, headers):
        return FUNDING if "funding" in url else OI
    evs = fetch(fake_get)
    sources = {e.source for e in evs}
    assert sources == {"funding", "oi"}

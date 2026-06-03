from btc_oracle.events.okx import parse_funding, parse_oi, fetch

FUNDING = {"code": "0", "data": [
    {"instId": "BTC-USD-SWAP", "fundingRate": "0.0001", "fundingTime": "1780502400000"},
]}
OI = {"code": "0", "data": [
    {"instId": "BTC-USD-SWAP", "oi": "7516", "oiCcy": "7516.94", "ts": "1780509600000"},
]}


def test_parse_funding_positive_is_crowded_long():
    e = parse_funding(FUNDING)
    assert e.source == "funding"
    assert abs(e.value - 0.0001) < 1e-12
    assert "long" in e.interpretation.lower()
    assert e.observed_at.startswith("2026-")


def test_parse_oi_uses_oiCcy():
    e = parse_oi(OI)
    assert e.source == "oi"
    assert abs(e.value - 7516.94) < 1e-6
    assert "BTC" in e.interpretation


def test_parse_empty_returns_none():
    assert parse_funding({"code": "0", "data": []}) is None
    assert parse_oi({"data": None}) is None


def test_fetch_returns_both_signals():
    def fake_get(url, params, headers):
        return FUNDING if "funding" in url else OI
    sources = {e.source for e in fetch(fake_get)}
    assert sources == {"funding", "oi"}

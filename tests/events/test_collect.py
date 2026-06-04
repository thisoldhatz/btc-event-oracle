from btc_oracle.events.collect import collect_events

FNG = {"data": [{"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
# OKX-shaped funding / open-interest responses (collect_events now uses the OKX adapter)
FUNDING = {"code": "0", "data": [{"instId": "BTC-USD-SWAP", "fundingRate": "0.00008", "fundingTime": "1780502400000"}]}
OI = {"code": "0", "data": [{"oi": "7516", "oiCcy": "59742.9", "ts": "1780509600000"}]}
DVOL = {"result": {"data": [
    [1780513200000, 44.0, 45.0, 43.5, 44.18],
    [1780516800000, 44.18, 46.34, 44.18, 46.34],
]}}


def test_collect_aggregates_all_sources():
    def fake_get(url, params, headers):
        if "alternative.me" in url:
            return FNG
        if "funding" in url:
            return FUNDING
        if "open-interest" in url:
            return OI
        if "deribit" in url:
            return DVOL
        if "gdelt" in url:
            return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
        raise AssertionError(url)
    evs = collect_events(fake_get)
    assert {"fng", "funding", "oi", "gdelt", "dvol"}.issubset({e.source for e in evs})


def test_collect_is_fail_soft_per_source():
    def fake_get(url, params, headers):
        if "gdelt" in url:
            raise RuntimeError("429 Too Many Requests")  # GDELT flaky
        if "alternative.me" in url:
            return FNG
        if "funding" in url:
            return FUNDING
        if "open-interest" in url:
            return OI
        raise AssertionError(url)
    evs = collect_events(fake_get)
    # GDELT failed but the rest survive
    assert "gdelt" not in {e.source for e in evs}
    assert {"fng", "funding", "oi"}.issubset({e.source for e in evs})

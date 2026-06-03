from btc_oracle.events.collect import collect_events

FNG = {"data": [{"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
FUNDING = {"result": {"list": [{"fundingRate": "0.00008", "fundingRateTimestamp": "1780502400000"}]}}
OI = {"result": {"list": [{"openInterest": "59742.9", "timestamp": "1780509600000"}]}}


def test_collect_aggregates_all_sources():
    def fake_get(url, params, headers):
        if "alternative.me" in url:
            return FNG
        if "funding" in url:
            return FUNDING
        if "open-interest" in url:
            return OI
        if "gdelt" in url:
            return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
        raise AssertionError(url)
    evs = collect_events(fake_get)
    assert {e.source for e in evs} == {"fng", "funding", "oi", "gdelt"}


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

# tests/events/test_gdelt.py
from btc_oracle.events.gdelt import parse_timeline, fetch_tone

PAYLOAD = {"timeline": [{"series": "Average Tone", "data": [
    {"date": "20260601T000000Z", "value": -1.0},
    {"date": "20260602T000000Z", "value": 1.0},
    {"date": "20260603T100000Z", "value": 4.0},
]}]}


def test_parse_takes_latest_and_delta_vs_prior_mean():
    e = parse_timeline(PAYLOAD, "news_tone")
    assert e.source == "gdelt"
    assert e.value == 4.0
    assert e.delta == 4.0 - 0.0   # latest 4.0 minus mean(-1,1)=0.0
    assert e.observed_at == "2026-06-03T10:00:00+00:00"


def test_parse_empty_returns_none():
    assert parse_timeline({"timeline": []}, "news_tone") is None
    assert parse_timeline({"timeline": [{"data": []}]}, "news_tone") is None


def test_fetch_tone_uses_getter():
    def fake_get(url, params, headers):
        assert params["mode"] == "timelinetone"
        return PAYLOAD
    evs = fetch_tone(fake_get)
    assert len(evs) == 1 and evs[0].value == 4.0

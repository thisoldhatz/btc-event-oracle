# tests/events/test_fear_greed.py
from btc_oracle.events.fear_greed import parse, fetch

PAYLOAD = {"data": [
    {"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"},
    {"value": "23", "value_classification": "Extreme Fear", "timestamp": "1780358400"},
]}


def test_parse_reads_value_and_delta():
    e = parse(PAYLOAD)
    assert e.source == "fng"
    assert e.value == 11.0
    assert e.delta == -12.0           # 11 - 23
    assert e.sentiment == "Extreme Fear"
    assert "Extreme Fear" in e.interpretation
    assert e.observed_at.startswith("2026-")


def test_parse_empty_returns_none():
    assert parse({"data": []}) is None


def test_fetch_uses_injected_getter():
    captured = {}
    def fake_get(url, params, headers):
        captured["url"] = url
        return PAYLOAD
    evs = fetch(fake_get)
    assert len(evs) == 1 and evs[0].value == 11.0
    assert "alternative.me" in captured["url"]

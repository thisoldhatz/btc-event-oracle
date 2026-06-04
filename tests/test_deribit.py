# tests/test_deribit.py
from btc_oracle.events.deribit import parse_dvol, fetch

PAYLOAD = {"result": {"data": [
    [1780513200000, 44.0, 45.0, 43.5, 44.18],
    [1780516800000, 44.18, 46.34, 44.18, 46.34],
]}}


def test_parse_dvol_latest_close_and_delta():
    e = parse_dvol(PAYLOAD)
    assert e.source == "dvol"
    assert abs(e.value - 46.34) < 1e-6          # latest close
    assert abs(e.delta - (46.34 - 44.18)) < 1e-6  # vs prior close
    assert "implied vol" in e.interpretation.lower()


def test_parse_empty_returns_none():
    assert parse_dvol({"result": {"data": []}}) is None


def test_fetch_uses_getter():
    captured = {}
    def fake_get(url, params, headers):
        captured["url"] = url
        return PAYLOAD
    evs = fetch(fake_get)
    assert len(evs) == 1 and "deribit" in captured["url"]

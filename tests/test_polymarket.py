# tests/test_polymarket.py
from btc_oracle.events.polymarket import parse_markets, fetch_markets

RAW = [
    {"question": "Will the price of Bitcoin be above $62,000 on June 4?",
     "outcomes": "[\"Yes\", \"No\"]", "outcomePrices": "[\"0.7125\", \"0.2875\"]",
     "endDate": "2026-06-04T12:00:00Z", "volume24hr": 50000},
    {"question": "Will Ethereum hit $4k?", "outcomes": "[\"Yes\",\"No\"]",
     "outcomePrices": "[\"0.1\",\"0.9\"]", "endDate": "x", "volume24hr": 999999},
    {"question": "Will Bitcoin reach $100,000 in June?", "outcomes": "[\"Yes\",\"No\"]",
     "outcomePrices": "[\"0.02\",\"0.98\"]", "endDate": "2026-06-30T12:00:00Z", "volume24hr": 12000},
]


def test_parse_markets_keeps_btc_only_with_yes_prob():
    out = parse_markets(RAW, limit=5)
    qs = [m["question"] for m in out]
    assert all("bitcoin" in q.lower() for q in qs)        # Ethereum dropped
    assert len(out) == 2
    m = out[0]
    assert "yes_prob" in m and 0 <= m["yes_prob"] <= 1
    assert m["yes_prob"] == 0.7125                         # parsed from JSON-string outcomePrices


def test_parse_handles_garbage_rows():
    out = parse_markets([{"question": "Will Bitcoin moon?", "outcomePrices": "not-json"}], limit=5)
    assert out == []                                      # unparseable -> skipped


def test_fetch_uses_getter_and_is_fail_soft():
    def fake_get(url, params, headers):
        assert "polymarket" in url
        return RAW
    assert len(fetch_markets(fake_get)) == 2
    def boom(url, params, headers):
        raise RuntimeError("down")
    assert fetch_markets(boom) == []                      # fail-soft

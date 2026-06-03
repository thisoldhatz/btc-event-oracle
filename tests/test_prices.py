# tests/test_prices.py
from btc_oracle.prices import ohlcv_to_rows, backfill, fetch_spot


class FakeExchange:
    """Returns one page of candles then empties (terminates pagination)."""
    def __init__(self, pages):
        self.pages = list(pages)
        self.calls = []

    def fetch_ohlcv(self, symbol, timeframe, since, limit):
        self.calls.append((symbol, timeframe, since, limit))
        return self.pages.pop(0) if self.pages else []


def test_ohlcv_to_rows_converts_ms_to_seconds():
    candles = [[1000, 1, 2, 0.5, 1.5, 9]]  # ms timestamp
    rows = ohlcv_to_rows(candles, "coinbase", "1d")
    assert rows == [("coinbase", "1d", 1.0, 1, 2, 0.5, 1.5, 9)]


def test_backfill_inserts_and_stops(mem_db):
    page = [[(i + 1) * 86_400_000, 0, 0, 0, 100.0 + i, 0] for i in range(5)]
    ex = FakeExchange([page])  # one page, then empty
    n = backfill(mem_db, ex, source="coinbase", timeframe="1d", page=300)
    assert n == 5
    from btc_oracle.store import get_closes
    assert get_closes(mem_db, "coinbase", "1d") == [100.0, 101.0, 102.0, 103.0, 104.0]


def test_fetch_spot_reads_coingecko_shape():
    def fake_get(url, params, headers):
        assert params["ids"] == "bitcoin"
        return {"bitcoin": {"usd": 64250.5}}
    assert fetch_spot(fake_get) == 64250.5

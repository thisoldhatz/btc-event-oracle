# src/btc_oracle/prices.py
from .store import insert_prices


def fetch_ohlcv(exchange, symbol="BTC/USD", timeframe="1d", since=None, limit=300):
    """Thin wrapper over a ccxt exchange (injected for tests)."""
    return exchange.fetch_ohlcv(symbol, timeframe, since, limit)


def ohlcv_to_rows(candles, source, interval):
    """ccxt candle = [ms_ts, open, high, low, close, volume] -> store row
    (source, interval, ts_seconds, open, high, low, close, volume)."""
    return [
        (source, interval, c[0] / 1000.0, c[1], c[2], c[3], c[4], c[5])
        for c in candles
    ]


def backfill(conn, exchange, *, source, symbol="BTC/USD", timeframe="1d",
             since_ms=None, page=300, max_pages=20):
    """Paginate OHLCV forward and persist. Stops on empty page, a short page,
    or a non-advancing cursor. Returns count of newly inserted rows."""
    total = 0
    cursor = since_ms
    last_seen = None
    for _ in range(max_pages):
        candles = fetch_ohlcv(exchange, symbol, timeframe, since=cursor, limit=page)
        if not candles:
            break
        total += insert_prices(conn, ohlcv_to_rows(candles, source, timeframe))
        newest = candles[-1][0]
        if newest == last_seen or len(candles) < page:
            break
        last_seen = newest
        cursor = newest + 1
    return total


def fetch_spot(http_get, demo_key=None):
    """http_get: callable(url, params, headers) -> dict. Injected for tests;
    in production pass a small httpx-backed getter."""
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {"ids": "bitcoin", "vs_currencies": "usd"}
    headers = {"x-cg-demo-api-key": demo_key} if demo_key else {}
    data = http_get(url, params, headers)
    return float(data["bitcoin"]["usd"])

# src/btc_oracle/prices.py
import math

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


def safe_backfill(conn, exchange, **kwargs) -> int:
    """backfill() that never aborts the hourly run. A single exchange OHLCV
    outage/rate-limit/shape-change must not blank the whole hour (forecast AND
    resolution); on failure we log and continue on the already-stored history."""
    try:
        return backfill(conn, exchange, **kwargs)
    except Exception as e:  # noqa: BLE001 - keep the run alive on existing closes
        print(f"[backfill] skipped this run, using stored history: {e}")
        return 0


def fetch_spot(http_get, demo_key=None):
    """http_get: callable(url, params, headers) -> dict. Injected for tests;
    in production pass a small httpx-backed getter."""
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {"ids": "bitcoin", "vs_currencies": "usd"}
    headers = {"x-cg-demo-api-key": demo_key} if demo_key else {}
    data = http_get(url, params, headers)
    return float(data["bitcoin"]["usd"])


def _plausible_spot(price, last_close, lo, hi, max_ratio) -> bool:
    """Guard against a glitched-but-positive price (decimal-shift, stale cache,
    1.0/0.0001) becoming an IMMUTABLE spot_at_issue that mis-scores forever.
    Rejects non-finite/out-of-band values and, when a recent close is known,
    anything more than max_ratio away from it."""
    try:
        p = float(price)
    except (TypeError, ValueError):
        return False
    if not math.isfinite(p) or p <= 0 or p < lo or p > hi:
        return False
    if last_close and last_close > 0:
        ratio = p / last_close
        if ratio > max_ratio or ratio < 1.0 / max_ratio:
            return False
    return True


def fetch_spot_resilient(http_get, demo_key=None, *, last_close=None,
                         lo=1_000.0, hi=10_000_000.0, max_ratio=2.5):
    """Live BTC/USD spot with multi-source failover: CoinGecko -> Coinbase -> Kraken.
    Returns (price, source). Raises only if EVERY source fails OR returns an
    implausible value. A single-source outage (or a single glitched quote) is the
    most common real failure mode, so we never let it break a run or poison the db."""
    sources = [
        ("coingecko", lambda: float(http_get(
            "https://api.coingecko.com/api/v3/simple/price",
            {"ids": "bitcoin", "vs_currencies": "usd"},
            {"x-cg-demo-api-key": demo_key} if demo_key else {})["bitcoin"]["usd"])),
        ("coinbase", lambda: float(http_get(
            "https://api.coinbase.com/v2/prices/BTC-USD/spot", {}, {})["data"]["amount"])),
        ("kraken", lambda: float(http_get(
            "https://api.kraken.com/0/public/Ticker", {"pair": "XBTUSD"}, {})["result"]["XXBTZUSD"]["c"][0])),
    ]
    last_err = None
    for name, fn in sources:
        try:
            price = fn()
        except Exception as e:  # noqa: BLE001 - any failure -> try next source
            last_err = e
            continue
        if _plausible_spot(price, last_close, lo, hi, max_ratio):
            return price, name
        last_err = ValueError(f"{name} returned implausible spot {price!r}")
    raise RuntimeError(f"all spot sources failed: {last_err}")

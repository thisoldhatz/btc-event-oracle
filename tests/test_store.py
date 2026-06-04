from btc_oracle.store import insert_prices, get_closes, table_names


def test_schema_creates_all_spec_tables(mem_db):
    names = table_names(mem_db)
    for t in ("runs", "forecasts", "events", "forecast_events", "scores", "price_history"):
        assert t in names


def test_insert_and_read_prices_ordered(mem_db):
    rows = [
        ("coinbase", "1d", 3.0, 0, 0, 0, 102.0, 0),
        ("coinbase", "1d", 1.0, 0, 0, 0, 100.0, 0),
        ("coinbase", "1d", 2.0, 0, 0, 0, 101.0, 0),
    ]
    n = insert_prices(mem_db, rows)
    assert n == 3
    closes = get_closes(mem_db, "coinbase", "1d")
    assert closes == [100.0, 101.0, 102.0]  # sorted by ts ascending


def test_insert_prices_upserts_latest_candle(mem_db):
    # The still-forming daily candle is re-fetched every hour; the latest values
    # must OVERWRITE the earlier partial ones (regression: the close used to
    # freeze at its first intraday reading, poisoning vol inputs + scoring).
    assert insert_prices(mem_db, [("coinbase", "1d", 1.0, 0, 0, 0, 100.0, 0)]) == 1
    insert_prices(mem_db, [("coinbase", "1d", 1.0, 1, 5, 0.5, 103.0, 9)])
    assert get_closes(mem_db, "coinbase", "1d") == [103.0]
    row = mem_db.execute("SELECT high, low, volume FROM price_history WHERE ts=1.0").fetchone()
    assert row["high"] == 5 and row["low"] == 0.5 and row["volume"] == 9


def test_get_closes_respects_limit(mem_db):
    rows = [("coinbase", "1d", float(i), 0, 0, 0, float(i), 0) for i in range(10)]
    insert_prices(mem_db, rows)
    assert get_closes(mem_db, "coinbase", "1d", limit=3) == [7.0, 8.0, 9.0]

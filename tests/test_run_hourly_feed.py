# tests/test_run_hourly_feed.py
import json
from btc_oracle.run_hourly import run_once
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings():
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94, mu_daily=0.0,
                    anthropic_api_key=None, coingecko_demo_key=None)


def _http_get(url, params, headers):
    if "alternative.me" in url:
        return {"data": [{"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
    if "funding" in url:
        return {"code": "0", "data": [{"fundingRate": "0.00008", "fundingTime": "1780502400000"}]}
    if "open-interest" in url:
        return {"code": "0", "data": [{"oi": "7516", "oiCcy": "59000", "ts": "1780509600000"}]}
    if "gdelt" in url:
        return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
    if "polymarket" in url:
        return []
    raise AssertionError(url)


def test_run_once_writes_signals_and_news(mem_db, tmp_path):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    news = [{"title": "BTC headline", "url": "https://x", "source": "CoinDesk", "published_at": "2026-06-03T20:00:00+00:00"}]
    run_once(mem_db, _settings(), now_iso="2026-06-03T21:00:00+00:00", spot=140.0,
             http_get=_http_get, claude_call=None, out_dir=str(tmp_path),
             model_id="baseline-only", news=news)
    latest = json.loads((tmp_path / "latest.json").read_text())
    # signals derived from the collected events (fng, funding, oi, gdelt)
    assert {s["source"] for s in latest["signals"]} >= {"fng", "funding", "oi", "gdelt"}
    assert latest["news"] == news


def test_run_once_news_defaults_empty(mem_db, tmp_path):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    run_once(mem_db, _settings(), now_iso="2026-06-03T21:00:00+00:00", spot=140.0,
             http_get=_http_get, claude_call=None, out_dir=str(tmp_path), model_id="baseline-only")
    latest = json.loads((tmp_path / "latest.json").read_text())
    assert latest["news"] == []
    assert len(latest["signals"]) >= 4

# tests/test_run_hourly.py
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
        return {"result": {"list": [{"fundingRate": "0.00008", "fundingRateTimestamp": "1780502400000"}]}}
    if "open-interest" in url:
        return {"result": {"list": [{"openInterest": "59000", "timestamp": "1780509600000"}]}}
    if "gdelt" in url:
        return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
    raise AssertionError(url)


def test_run_once_persists_run_forecasts_events_and_snapshots(mem_db, tmp_path):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    summary = run_once(mem_db, _settings(), now_iso="2026-06-03T10:00:00+00:00",
                       spot=140.0, http_get=_http_get, claude_call=None,
                       out_dir=str(tmp_path), model_id="baseline-only")
    assert summary["forecasts"] == 3
    assert summary["events"] >= 4               # fng, funding, oi, gdelt
    assert summary["resolved"] == 0             # nothing matured yet
    assert mem_db.execute("SELECT COUNT(*) c FROM runs").fetchone()["c"] == 1
    assert mem_db.execute("SELECT COUNT(*) c FROM forecasts").fetchone()["c"] == 3
    assert mem_db.execute("SELECT COUNT(*) c FROM forecast_events").fetchone()["c"] == 3 * summary["events"]
    # target_at = now + horizon days
    row = mem_db.execute("SELECT target_at FROM forecasts WHERE horizon='1w'").fetchone()
    assert row["target_at"].startswith("2026-06-10")
    data = json.loads((tmp_path / "latest.json").read_text())
    assert len(data["forecasts"]) == 3


def test_run_once_resolves_a_matured_prior_forecast(mem_db, tmp_path):
    # a prior 1w forecast issued at spot 100, target already passed, realized price present
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    from btc_oracle.store import insert_run, insert_forecast
    from btc_oracle.baseline import baseline_forecast
    from btc_oracle.overlay import apply_overlay
    from datetime import datetime, timezone
    target = datetime(2026, 6, 1, tzinfo=timezone.utc)
    insert_prices(mem_db, [("coinbase", "1d", target.timestamp(), 0, 0, 0, 130.0, 0)])
    rid = insert_run(mem_db, run_at="2026-05-25T00:00:00+00:00", spot_at_issue=120.0,
                     spot_source="cg", model_id="m", prompt_version="v",
                     engine_version="e", llm_applied=False)
    b = baseline_forecast(spot=120.0, sigma_daily=0.03, horizon="1w", horizon_days=7,
                          mu_daily=0.0, conf_level=0.60)
    f = apply_overlay(b, {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
                          "p_up_override": None, "confidence": "low"}, llm_applied=False)
    insert_forecast(mem_db, run_id=rid, target_at=target.isoformat(), forecast=f,
                    rationale="r", drift_mode="zero")

    summary = run_once(mem_db, _settings(), now_iso="2026-06-03T10:00:00+00:00",
                       spot=140.0, http_get=_http_get, claude_call=None,
                       out_dir=str(tmp_path), model_id="baseline-only")
    assert summary["resolved"] == 1
    assert mem_db.execute("SELECT COUNT(*) c FROM scores").fetchone()["c"] == 1

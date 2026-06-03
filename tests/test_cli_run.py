# tests/test_cli_run.py
import json
from btc_oracle.cli import run_cycle
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings(tmp):
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94, mu_daily=0.0,
                    anthropic_api_key=None, coingecko_demo_key=None, snapshot_dir=str(tmp))


def _http_get(url, params, headers):
    if "alternative.me" in url:
        return {"data": [{"value": "20", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
    return {"result": {"list": []}, "timeline": []}  # other sources empty -> fail soft


def test_run_cycle_writes_snapshots_to_settings_dir(mem_db, tmp_path):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    summary = run_cycle(mem_db, _settings(tmp_path), now_iso="2026-06-03T10:00:00+00:00",
                        spot=140.0, http_get=_http_get, claude_call=None)
    assert summary["forecasts"] == 3
    assert (tmp_path / "latest.json").exists()
    assert json.loads((tmp_path / "scores.json").read_text())["1w"]["n"] == 0

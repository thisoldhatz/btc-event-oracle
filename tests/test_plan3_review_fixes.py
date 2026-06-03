"""Post-review hardening for Plan 3 (from the Opus final review):
1. overlay parses Claude JSON even when wrapped in markdown fences / prose.
2. stored model_id reflects the ACTUAL llm_applied outcome, not key presence.
3. _iso_to_epoch treats naive ISO timestamps as UTC (resolution-timing safety).
"""
import json
from btc_oracle.overlay import run_overlay, _extract_json
from btc_oracle.baseline import build_baseline_forecasts


def _baselines():
    return build_baseline_forecasts(spot=60000.0, sigma_daily=0.03)


VALID = {"horizons": {
    "1w": {"drift_adj_bps": 20, "vol_mult": 1.1, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
    "1m": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
    "1y": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
}, "rationale": "ok", "event_refs": []}


def test_extract_json_strips_markdown_fences():
    fenced = "```json\n" + json.dumps(VALID) + "\n```"
    assert json.loads(_extract_json(fenced)) == VALID


def test_run_overlay_applies_despite_fenced_response():
    def fenced_claude(system, user):
        return "Here is the adjustment:\n```json\n" + json.dumps(VALID) + "\n```"
    forecasts, rationale, applied = run_overlay(_baselines(), "events", fenced_claude)
    assert applied is True
    assert rationale == "ok"
    f1w = next(f for f in forecasts if f.horizon == "1w")
    assert f1w.vol_mult == 1.1


def test_run_once_model_id_reflects_actual_llm_applied(mem_db, tmp_path):
    from btc_oracle.run_hourly import run_once
    from btc_oracle.config import Settings
    from btc_oracle.store import insert_prices
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    s = Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94, mu_daily=0.0,
                 anthropic_api_key=None, coingecko_demo_key=None, snapshot_dir=str(tmp_path))

    def http_get(url, params, headers):
        return {"data": [], "result": {"list": []}, "timeline": []}

    # claude_call=None forces fallback; stored model must be baseline-only even
    # though we pass a Claude model name.
    run_once(mem_db, s, now_iso="2026-06-03T10:00:00+00:00", spot=140.0,
             http_get=http_get, claude_call=None, out_dir=str(tmp_path), model_id="claude-sonnet-4-6")
    row = mem_db.execute("SELECT model_id, llm_applied FROM runs").fetchone()
    assert row["llm_applied"] == 0
    assert row["model_id"] == "baseline-only"


def test_iso_to_epoch_treats_naive_as_utc():
    from datetime import datetime, timezone
    from btc_oracle.resolve import _iso_to_epoch
    aware = _iso_to_epoch("2026-06-08T00:00:00+00:00")
    naive = _iso_to_epoch("2026-06-08T00:00:00")
    assert abs(aware - naive) < 1e-6
    assert abs(aware - datetime(2026, 6, 8, tzinfo=timezone.utc).timestamp()) < 1e-6

# tests/test_snapshots.py
import json
from btc_oracle.snapshots import build_latest, build_history, build_scores, write_snapshots
from btc_oracle.store import insert_run, insert_forecast, insert_score
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


def _f(horizon, days):
    b = baseline_forecast(spot=65000.0, sigma_daily=0.03, horizon=horizon,
                          horizon_days=days, mu_daily=0.0, conf_level=0.60)
    return apply_overlay(b, {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
                             "p_up_override": None, "confidence": "low"}, llm_applied=False)


def _seed_run(conn, run_at, spot):
    rid = insert_run(conn, run_at=run_at, spot_at_issue=spot, spot_source="cg",
                     model_id="claude-sonnet-4-6", prompt_version="v",
                     engine_version="0.1.0", llm_applied=True)
    for h, d in (("1w", 7), ("1m", 30), ("1y", 365)):
        insert_forecast(conn, run_id=rid, target_at=f"2026-07-0{1}T00:00:00+00:00",
                        forecast=_f(h, d), rationale="why", drift_mode="zero")
    return rid


def test_build_latest_uses_newest_run(mem_db):
    _seed_run(mem_db, "2026-06-01T00:00:00+00:00", 64000.0)
    _seed_run(mem_db, "2026-06-03T00:00:00+00:00", 65000.0)
    latest = build_latest(mem_db)
    assert latest["spot"] == 65000.0
    assert latest["llm_applied"] is True
    assert {f["horizon"] for f in latest["forecasts"]} == {"1w", "1m", "1y"}
    assert "rationale" in latest["forecasts"][0]


def test_build_history_groups_by_horizon(mem_db):
    _seed_run(mem_db, "2026-06-01T00:00:00+00:00", 64000.0)
    _seed_run(mem_db, "2026-06-03T00:00:00+00:00", 65000.0)
    hist = build_history(mem_db)
    assert set(hist.keys()) == {"1w", "1m", "1y"}
    assert len(hist["1w"]) == 2


def test_build_scores_aggregates(mem_db):
    rid = _seed_run(mem_db, "2026-06-01T00:00:00+00:00", 64000.0)
    fid = mem_db.execute("SELECT forecast_id FROM forecasts WHERE horizon='1w'").fetchone()["forecast_id"]
    insert_score(mem_db, {"forecast_id": fid, "horizon": "1w", "resolved_at": "t",
                          "realized_price": 66000.0, "up_outcome": 1, "brier": 0.09,
                          "brier_base": 0.25, "bss": 0.64, "ae": 1000.0, "ape": 1.5,
                          "mae_ratio": 0.5, "covered": 1})
    sc = build_scores(mem_db)
    assert sc["1w"]["n"] == 1
    assert abs(sc["1w"]["brier"] - 0.09) < 1e-9
    assert sc["1y"]["n"] == 0


def test_write_snapshots_emits_three_files(mem_db, tmp_path):
    _seed_run(mem_db, "2026-06-01T00:00:00+00:00", 64000.0)
    written = write_snapshots(mem_db, str(tmp_path))
    assert set(written) == {"latest.json", "history.json", "scores.json"}
    data = json.loads((tmp_path / "latest.json").read_text())
    assert data["spot"] == 64000.0

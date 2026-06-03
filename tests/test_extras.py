# tests/test_extras.py
from btc_oracle.store import (insert_run, insert_forecast, insert_score, get_timeline, get_results)
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


def _f(p_up, horizon="1w", horizon_days=7):
    b = baseline_forecast(spot=65000.0, sigma_daily=0.03, horizon=horizon, horizon_days=horizon_days,
                          mu_daily=0.0, conf_level=0.60)
    return apply_overlay(b, {"drift_adj_bps": -15.0, "vol_mult": 1.15, "skew_adj": 0.0,
                             "p_up_override": p_up, "confidence": "low"}, llm_applied=True)


def _seed_run(conn, run_at, spot, p_up=0.5, rationale="r"):
    rid = insert_run(conn, run_at=run_at, spot_at_issue=spot, spot_source="cg", model_id="m",
                     prompt_version="v", engine_version="e", llm_applied=True)
    for h, d in (("1w", 7), ("1m", 30), ("1y", 365)):
        f = _f(p_up, horizon=h, horizon_days=d)
        fid = insert_forecast(conn, run_id=rid, target_at=run_at, forecast=f,
                              rationale=rationale, drift_mode="zero")
    conn.commit()
    return rid


def test_get_timeline_is_newest_first_and_one_per_run(mem_db):
    _seed_run(mem_db, "2026-06-03T20:00:00+00:00", 64000.0, p_up=0.45, rationale="cautious")
    _seed_run(mem_db, "2026-06-03T21:00:00+00:00", 65000.0, p_up=0.55, rationale="optimistic")
    rows = get_timeline(mem_db, limit=10)
    assert rows[0]["run_at"] == "2026-06-03T21:00:00+00:00"     # newest first
    assert rows[0]["rationale"] == "optimistic"
    assert abs(rows[0]["p_up"] - 0.55) < 1e-9
    assert "drift_adj_bps" in rows[0].keys()
    # one entry per run (the 1w forecast), not 3
    assert len(rows) == 2


def test_get_results_returns_resolved_with_predicted_and_actual(mem_db):
    rid = _seed_run(mem_db, "2026-05-27T00:00:00+00:00", 64000.0, p_up=0.6)
    fid = mem_db.execute("SELECT forecast_id FROM forecasts WHERE run_id=? AND horizon='1w'", (rid,)).fetchone()["forecast_id"]
    insert_score(mem_db, {"forecast_id": fid, "horizon": "1w", "resolved_at": "2026-06-03T00:00:00+00:00",
                          "realized_price": 66000.0, "up_outcome": 1, "brier": 0.16, "brier_base": 0.25,
                          "bss": 0.36, "ae": 1000.0, "ape": 1.5, "mae_ratio": 1.0, "covered": 1})
    rows = get_results(mem_db, limit=10)
    assert len(rows) == 1
    r = rows[0]
    assert r["horizon"] == "1w"
    assert r["realized_price"] == 66000.0
    assert r["up_outcome"] == 1
    assert r["spot_at_issue"] == 64000.0
    assert "central" in r.keys() and "lower" in r.keys() and "p_up" in r.keys()


def test_empty_when_nothing(mem_db):
    assert get_timeline(mem_db) == []
    assert get_results(mem_db) == []

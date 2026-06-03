from btc_oracle.store import insert_run, insert_event, link_forecast_event
from btc_oracle.events.base import Event


# Task 3 additions
from btc_oracle.store import insert_forecast
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


# Task 4 additions
from btc_oracle.store import (
    get_unresolved_matured, get_close_on_or_after, mark_resolved, insert_score,
    get_latest_run, get_forecasts_for_run, get_forecast_history, get_scores,
    insert_prices,
)


def _seed_forecast(conn, *, run_at, target_at, spot, horizon="1w"):
    rid = insert_run(conn, run_at=run_at, spot_at_issue=spot, spot_source="cg",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=False)
    f = _enriched()
    fid = insert_forecast(conn, run_id=rid, target_at=target_at, forecast=f,
                          rationale="r", drift_mode="zero")
    return rid, fid


def test_get_unresolved_matured_filters_by_time(mem_db):
    _seed_forecast(mem_db, run_at="2026-06-01T00:00:00+00:00",
                   target_at="2026-06-08T00:00:00+00:00", spot=65000.0)   # matured
    _seed_forecast(mem_db, run_at="2026-06-03T00:00:00+00:00",
                   target_at="2026-07-03T00:00:00+00:00", spot=66000.0)   # future
    rows = get_unresolved_matured(mem_db, "2026-06-10T00:00:00+00:00")
    assert len(rows) == 1
    assert rows[0]["spot_at_issue"] == 65000.0   # joined from runs


def test_get_close_on_or_after(mem_db):
    insert_prices(mem_db, [("coinbase", "1d", 100.0, 0, 0, 0, 10.0, 0),
                           ("coinbase", "1d", 200.0, 0, 0, 0, 20.0, 0)])
    assert get_close_on_or_after(mem_db, "coinbase", "1d", 150.0) == 20.0
    assert get_close_on_or_after(mem_db, "coinbase", "1d", 999.0) is None


def test_mark_resolved_and_insert_score(mem_db):
    _, fid = _seed_forecast(mem_db, run_at="t", target_at="t2", spot=65000.0)
    insert_score(mem_db, {"forecast_id": fid, "horizon": "1w", "resolved_at": "t3",
                          "realized_price": 66000.0, "up_outcome": 1, "brier": 0.16,
                          "brier_base": 0.25, "bss": 0.36, "ae": 1000.0, "ape": 1.5,
                          "mae_ratio": 1.0, "covered": 1})
    mark_resolved(mem_db, fid)
    assert mem_db.execute("SELECT resolved FROM forecasts WHERE forecast_id=?",
                          (fid,)).fetchone()["resolved"] == 1
    s = get_scores(mem_db, "1w")
    assert len(s) == 1 and s[0]["bss"] == 0.36


def test_latest_run_and_history(mem_db):
    _seed_forecast(mem_db, run_at="2026-06-01T00:00:00+00:00", target_at="2026-06-08T00:00:00+00:00", spot=64000.0)
    _seed_forecast(mem_db, run_at="2026-06-02T00:00:00+00:00", target_at="2026-06-09T00:00:00+00:00", spot=65000.0)
    assert get_latest_run(mem_db)["spot_at_issue"] == 65000.0   # newest run_at
    hist = get_forecast_history(mem_db, "1w")
    assert len(hist) == 2 and hist[0]["run_at"] <= hist[1]["run_at"]  # ascending
    fr = get_forecasts_for_run(mem_db, get_latest_run(mem_db)["run_id"])
    assert len(fr) == 1


def _enriched():
    b = baseline_forecast(spot=65000.0, sigma_daily=0.03, horizon="1w",
                          horizon_days=7, mu_daily=0.0, conf_level=0.60)
    adj = {"drift_adj_bps": 20.0, "vol_mult": 1.1, "skew_adj": 0.0,
           "p_up_override": None, "confidence": "medium"}
    return apply_overlay(b, adj, llm_applied=True)


def test_insert_forecast_maps_all_fields(mem_db):
    rid = insert_run(mem_db, run_at="t0", spot_at_issue=65000.0, spot_source="cg",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=True)
    f = _enriched()
    fid = insert_forecast(mem_db, run_id=rid, target_at="2026-06-10T10:00:00+00:00",
                          forecast=f, rationale="crowded longs", drift_mode="zero")
    row = mem_db.execute("SELECT * FROM forecasts WHERE forecast_id=?", (fid,)).fetchone()
    assert row["horizon"] == "1w"
    assert row["target_at"] == "2026-06-10T10:00:00+00:00"
    assert abs(row["central"] - f.central) < 1e-9
    assert abs(row["baseline_central"] - f.baseline_central) < 1e-9
    assert row["drift_adj_bps"] == 20.0 and row["vol_mult"] == 1.1
    assert row["drift_mode"] == "zero"
    assert row["rationale"] == "crowded longs"
    assert row["resolved"] == 0


def test_insert_run_returns_id_and_persists(mem_db):
    rid = insert_run(mem_db, run_at="2026-06-03T10:00:00+00:00", spot_at_issue=65000.0,
                     spot_source="coingecko", model_id="m1", prompt_version="v1",
                     engine_version="0.1.0", llm_applied=True)
    assert isinstance(rid, str) and len(rid) >= 16
    row = mem_db.execute("SELECT * FROM runs WHERE run_id=?", (rid,)).fetchone()
    assert row["spot_at_issue"] == 65000.0
    assert row["llm_applied"] == 1


def test_insert_event_stores_raw_as_json(mem_db):
    e = Event(source="fng", signal="fear_greed", value=11.0, delta=-12.0,
              interpretation="Extreme Fear", observed_at="2026-06-03T00:00:00+00:00",
              sentiment="Extreme Fear", raw={"value": "11"})
    eid = insert_event(mem_db, e)
    row = mem_db.execute("SELECT * FROM events WHERE event_id=?", (eid,)).fetchone()
    assert row["source"] == "fng" and row["value"] == 11.0
    assert '"value": "11"' in row["raw"]


def test_link_forecast_event_is_idempotent(mem_db):
    # forecast row must exist for FK; insert a minimal run+forecast first
    rid = insert_run(mem_db, run_at="t", spot_at_issue=1.0, spot_source="x",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=False)
    mem_db.execute("INSERT INTO forecasts (forecast_id, run_id, horizon, target_at, central, p_up) "
                   "VALUES ('f1', ?, '1w', 't2', 1.0, 0.5)", (rid,))
    e = Event(source="fng", signal="s", value=1.0, delta=None, interpretation="i",
              observed_at="t")
    eid = insert_event(mem_db, e)
    link_forecast_event(mem_db, "f1", eid)
    link_forecast_event(mem_db, "f1", eid)  # duplicate -> ignored
    n = mem_db.execute("SELECT COUNT(*) c FROM forecast_events").fetchone()["c"]
    assert n == 1

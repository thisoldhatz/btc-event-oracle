from btc_oracle.store import insert_run, insert_event, link_forecast_event
from btc_oracle.events.base import Event


# Task 3 additions
from btc_oracle.store import insert_forecast
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


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

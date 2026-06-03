from btc_oracle.store import insert_run, insert_event, link_forecast_event
from btc_oracle.events.base import Event


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

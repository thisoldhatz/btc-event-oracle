from btc_oracle.store import (insert_run, insert_forecast, insert_score, insert_event,
                              get_signal_history)
from btc_oracle.events.base import Event
from btc_oracle.baseline import forecast_from_sigma_h
from btc_oracle.snapshots import build_weekly_recaps, build_seo


def _resolved_call(conn, *, target_at, p_up, up_outcome, central=65000.0, realized=66000.0, covered=1):
    rid = insert_run(conn, run_at="2026-06-01T00:00:00+00:00", spot_at_issue=65000.0, spot_source="cg",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=True)
    f = forecast_from_sigma_h(spot=65000.0, sigma_h=0.06, horizon="1w", horizon_days=7,
                              mu_daily=0.0, conf_level=0.60, vol_model="gjr-garch", vol_window=300)
    fid = insert_forecast(conn, run_id=rid, target_at=target_at, forecast=f, rationale="r", drift_mode="zero")
    conn.execute("UPDATE forecasts SET p_up=?, central=? WHERE forecast_id=?", (p_up, central, fid))
    conn.commit()
    insert_score(conn, {"forecast_id": fid, "horizon": "1w", "resolved_at": target_at,
                        "realized_price": realized, "up_outcome": up_outcome,
                        "brier": (p_up - up_outcome) ** 2, "brier_base": (0.5 - up_outcome) ** 2,
                        "bss": 0.0, "ae": abs(realized - central), "ape": 1.0, "mae_ratio": 1.0,
                        "covered": covered, "crps": 0.02, "crps_rw": 0.03, "pit": 0.5})


def test_get_signal_history_newest_first(mem_db):
    for i, v in enumerate([10.0, 12.0, 15.0]):
        insert_event(mem_db, Event(source="fng", signal="fear_greed", value=v, delta=None,
                                   interpretation="x", observed_at=f"2026-06-0{i + 1}T00:00:00+00:00"))
    h = get_signal_history(mem_db, "fear_greed", limit=10)
    assert len(h) == 3 and h[0]["value"] == 15.0


def test_build_weekly_recaps_groups_and_aggregates(mem_db):
    # two calls in the same ISO week (Jun 9 & 10, 2026): one correct, one wrong
    _resolved_call(mem_db, target_at="2026-06-09T00:00:00+00:00", p_up=0.7, up_outcome=1)   # hit
    _resolved_call(mem_db, target_at="2026-06-10T00:00:00+00:00", p_up=0.7, up_outcome=0)   # miss
    recaps = build_weekly_recaps(mem_db)
    assert len(recaps) == 1
    wk = recaps[0]
    assert wk["n"] == 2 and abs(wk["hit_rate"] - 0.5) < 1e-9
    assert wk["coverage_rate"] is not None and wk["avg_pct_err"] is not None
    assert len(wk["items"]) == 2


def test_build_seo_shape(mem_db):
    s = build_seo(mem_db)
    assert set(s.keys()) == {"as_of", "signals", "recaps"}
    assert "fear_greed" in s["signals"] and isinstance(s["recaps"], list)

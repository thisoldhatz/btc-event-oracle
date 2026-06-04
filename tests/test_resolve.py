# tests/test_resolve.py
from datetime import datetime, timezone, timedelta
from btc_oracle.resolve import resolve_matured
from btc_oracle.store import (insert_run, insert_forecast, insert_prices, get_scores)
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


def _enriched(spot, central, lower, upper, p_up):
    # Build a minimal EnrichedForecast with chosen band by hand via apply_overlay then override-free
    b = baseline_forecast(spot=spot, sigma_daily=0.03, horizon="1w", horizon_days=7,
                          mu_daily=0.0, conf_level=0.60)
    f = apply_overlay(b, {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
                          "p_up_override": p_up, "confidence": "medium"}, llm_applied=False)
    return f


def test_resolves_matured_forecast_and_writes_score(mem_db):
    target = datetime(2026, 6, 8, tzinfo=timezone.utc)
    target_iso = target.isoformat()
    # a realized daily close exactly at the target date
    insert_prices(mem_db, [("coinbase", "1d", target.timestamp(), 0, 0, 0, 71000.0, 0)])
    rid = insert_run(mem_db, run_at="2026-06-01T00:00:00+00:00", spot_at_issue=65000.0,
                     spot_source="cg", model_id="m", prompt_version="v",
                     engine_version="e", llm_applied=False)
    f = _enriched(65000.0, 65000.0, 60000.0, 70000.0, 0.6)
    insert_forecast(mem_db, run_id=rid, target_at=target_iso, forecast=f,
                    rationale="r", drift_mode="zero")

    now = "2026-06-10T00:00:00+00:00"
    out = resolve_matured(mem_db, now)
    assert len(out) == 1
    s = get_scores(mem_db, "1w")[0]
    assert s["realized_price"] == 71000.0
    assert s["up_outcome"] == 1            # 71000 > 65000
    assert s["covered"] == 0               # 71000 > upper 70000


def test_skips_when_no_price_yet(mem_db):
    rid = insert_run(mem_db, run_at="t", spot_at_issue=65000.0, spot_source="cg",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=False)
    f = _enriched(65000.0, 65000.0, 60000.0, 70000.0, 0.5)
    insert_forecast(mem_db, run_id=rid, target_at="2026-06-08T00:00:00+00:00",
                    forecast=f, rationale="r", drift_mode="zero")
    # no price_history rows -> cannot resolve
    out = resolve_matured(mem_db, "2026-06-10T00:00:00+00:00")
    assert out == []
    assert get_scores(mem_db, "1w") == []


# Task 2 (Phase C) additions
from btc_oracle.store import get_scored_detail


def test_resolution_persists_crps(mem_db):
    from datetime import datetime, timezone
    from btc_oracle.store import insert_run, insert_forecast, insert_prices
    from btc_oracle.baseline import forecast_from_sigma_h
    target = datetime(2026, 6, 8, tzinfo=timezone.utc)
    insert_prices(mem_db, [("coinbase", "1d", target.timestamp(), 0, 0, 0, 71000.0, 0)])
    rid = insert_run(mem_db, run_at="2026-06-01T00:00:00+00:00", spot_at_issue=65000.0,
                     spot_source="cg", model_id="m", prompt_version="v", engine_version="e", llm_applied=False)
    f = forecast_from_sigma_h(spot=65000.0, sigma_h=0.06, horizon="1w", horizon_days=7,
                              mu_daily=0.0, conf_level=0.60, vol_model="gjr-garch", vol_window=300)
    insert_forecast(mem_db, run_id=rid, target_at=target.isoformat(), forecast=f,
                    rationale="r", drift_mode="zero")
    from btc_oracle.resolve import resolve_matured
    resolve_matured(mem_db, "2026-06-10T00:00:00+00:00")
    detail = get_scored_detail(mem_db, "1w")
    assert detail[0]["crps"] is not None and detail[0]["crps"] > 0

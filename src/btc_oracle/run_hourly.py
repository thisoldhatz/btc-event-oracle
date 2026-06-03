# src/btc_oracle/run_hourly.py
from datetime import datetime, timedelta
from .store import (insert_run, insert_event, insert_forecast, link_forecast_event)
from .resolve import resolve_matured
from .snapshots import write_snapshots, event_to_signal


def run_once(conn, settings, *, now_iso, spot, http_get, claude_call, out_dir, model_id="baseline-only", news=None):
    """One full hourly cycle: build event-aware forecasts, persist them, resolve any
    matured prior forecasts, and emit JSON snapshots. Returns a summary dict."""
    from .cli import build_enriched_forecasts  # local import avoids a cli<->run_hourly cycle

    forecasts, rationale, llm_applied, events = build_enriched_forecasts(
        conn, settings, spot=spot, http_get=http_get, claude_call=claude_call)

    # Record the model that ACTUALLY shaped this run. If the overlay fell back to
    # the baseline (llm_applied=False), the provenance is baseline-only regardless
    # of whether an API key was configured.
    stored_model = model_id if llm_applied else "baseline-only"
    run_id = insert_run(conn, run_at=now_iso, spot_at_issue=spot, spot_source="coingecko",
                        model_id=stored_model, prompt_version="v1", engine_version="0.1.0",
                        llm_applied=llm_applied)
    drift_mode = "zero" if settings.mu_daily == 0 else f"mu={settings.mu_daily}"
    event_ids = [insert_event(conn, e) for e in events]

    base_dt = datetime.fromisoformat(now_iso)
    for f in forecasts:
        target_at = (base_dt + timedelta(days=f.horizon_days)).isoformat()
        fid = insert_forecast(conn, run_id=run_id, target_at=target_at, forecast=f,
                              rationale=rationale, drift_mode=drift_mode)
        for eid in event_ids:
            link_forecast_event(conn, fid, eid)

    resolved = resolve_matured(conn, now_iso)
    signals = [event_to_signal(e) for e in events]
    written = write_snapshots(conn, out_dir, signals=signals, news=news or [])
    return {"run_id": run_id, "forecasts": len(forecasts), "events": len(event_ids),
            "resolved": len(resolved), "llm_applied": llm_applied, "snapshots": written,
            "news": len(news or [])}

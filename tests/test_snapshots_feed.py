# tests/test_snapshots_feed.py
from btc_oracle.snapshots import event_to_signal, build_latest, write_snapshots
from btc_oracle.store import insert_run, insert_forecast
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay
from btc_oracle.events.base import Event
import json


def _seed(conn):
    rid = insert_run(conn, run_at="2026-06-03T20:00:00+00:00", spot_at_issue=65000.0,
                     spot_source="cg", model_id="m", prompt_version="v",
                     engine_version="e", llm_applied=True)
    b = baseline_forecast(spot=65000.0, sigma_daily=0.03, horizon="1w", horizon_days=7,
                          mu_daily=0.0, conf_level=0.60)
    f = apply_overlay(b, {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
                          "p_up_override": None, "confidence": "low"}, llm_applied=True)
    insert_forecast(conn, run_id=rid, target_at="2026-06-10T20:00:00+00:00", forecast=f,
                    rationale="r", drift_mode="zero")


def test_event_to_signal_shape():
    e = Event(source="fng", signal="fear_greed", value=11.0, delta=-12.0,
              interpretation="Extreme Fear", observed_at="2026-06-03T00:00:00+00:00")
    assert event_to_signal(e) == {
        "source": "fng", "signal": "fear_greed", "value": 11.0, "delta": -12.0,
        "interpretation": "Extreme Fear", "observed_at": "2026-06-03T00:00:00+00:00",
    }


def test_build_latest_includes_signals_and_news(mem_db):
    _seed(mem_db)
    signals = [event_to_signal(Event(source="fng", signal="fear_greed", value=11.0,
               delta=-12.0, interpretation="x", observed_at="t"))]
    news = [{"title": "BTC up", "url": "u", "source": "CoinDesk", "published_at": "t"}]
    latest = build_latest(mem_db, signals=signals, news=news)
    assert latest["signals"] == signals
    assert latest["news"] == news
    assert len(latest["forecasts"]) == 1


def test_build_latest_defaults_empty(mem_db):
    _seed(mem_db)
    latest = build_latest(mem_db)
    assert latest["signals"] == []
    assert latest["news"] == []


def test_write_snapshots_passes_signals_and_news(mem_db, tmp_path):
    _seed(mem_db)
    write_snapshots(mem_db, str(tmp_path),
                    signals=[{"source": "fng"}], news=[{"title": "x"}])
    data = json.loads((tmp_path / "latest.json").read_text())
    assert data["signals"] == [{"source": "fng"}]
    assert data["news"] == [{"title": "x"}]

# tests/test_cli_preview.py
import json
from btc_oracle.cli import build_enriched_forecasts
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings():
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94, mu_daily=0.0,
                    anthropic_api_key=None, coingecko_demo_key=None)


def test_build_enriched_forecasts_with_events_and_fake_llm(mem_db):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])

    def fake_http_get(url, params, headers):
        if "alternative.me" in url:
            return {"data": [{"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
        if "funding" in url:
            return {"result": {"list": [{"fundingRate": "0.00008", "fundingRateTimestamp": "1780502400000"}]}}
        if "open-interest" in url:
            return {"result": {"list": [{"openInterest": "59000", "timestamp": "1780509600000"}]}}
        if "gdelt" in url:
            return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
        raise AssertionError(url)

    def fake_claude(system, user):
        return json.dumps({"horizons": {
            "1w": {"drift_adj_bps": 20, "vol_mult": 1.1, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
            "1m": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
            "1y": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
        }, "rationale": "fear is high", "event_refs": []})

    forecasts, rationale, applied, events = build_enriched_forecasts(
        mem_db, _settings(), spot=140.0, http_get=fake_http_get, claude_call=fake_claude)

    assert applied is True
    assert rationale == "fear is high"
    assert len(forecasts) == 3
    assert {e.source for e in events} >= {"fng", "funding", "oi", "gdelt"}
    f1w = next(f for f in forecasts if f.horizon == "1w")
    assert f1w.vol_mult == 1.1


def test_build_enriched_forecasts_without_llm_falls_back(mem_db):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])

    def fake_http_get(url, params, headers):
        return {"data": []} if "alternative.me" in url else {"result": {"list": []}, "timeline": []}

    # claude_call=None simulates "no API key configured" -> fallback path
    forecasts, rationale, applied, events = build_enriched_forecasts(
        mem_db, _settings(), spot=140.0, http_get=fake_http_get, claude_call=None)
    assert applied is False
    assert len(forecasts) == 3

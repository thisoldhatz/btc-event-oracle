import math
import pytest
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import parse_and_clamp, DRIFT_CAP_BPS, VOL_MULT_BOUNDS, apply_overlay, EnrichedForecast

GOOD = {
    "horizons": {
        "1w": {"drift_adj_bps": 35, "vol_mult": 1.10, "skew_adj": -0.05, "p_up_override": None, "confidence": "medium"},
        "1m": {"drift_adj_bps": 80, "vol_mult": 1.05, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
        "1y": {"drift_adj_bps": 0, "vol_mult": 1.00, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
    },
    "rationale": "test",
    "event_refs": [],
}


def test_in_bounds_values_pass_through():
    adj = parse_and_clamp(GOOD)
    assert adj["horizons"]["1w"]["drift_adj_bps"] == 35
    assert adj["horizons"]["1w"]["vol_mult"] == 1.10


def test_out_of_bounds_are_clamped():
    payload = {"horizons": {
        "1w": {"drift_adj_bps": 9999, "vol_mult": 5.0, "skew_adj": -3.0, "p_up_override": 0.99, "confidence": "high"},
        "1m": {"drift_adj_bps": -9999, "vol_mult": 0.01, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
        "1y": {"drift_adj_bps": 500, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
    }, "rationale": "x", "event_refs": []}
    adj = parse_and_clamp(payload)
    assert adj["horizons"]["1w"]["drift_adj_bps"] == DRIFT_CAP_BPS["1w"]       # +50
    assert adj["horizons"]["1m"]["drift_adj_bps"] == -DRIFT_CAP_BPS["1m"]      # -150
    assert adj["horizons"]["1y"]["drift_adj_bps"] == DRIFT_CAP_BPS["1y"]       # +100
    assert adj["horizons"]["1w"]["vol_mult"] == VOL_MULT_BOUNDS[1]            # 1.5
    assert adj["horizons"]["1m"]["vol_mult"] == VOL_MULT_BOUNDS[0]            # 0.8
    assert -0.2 <= adj["horizons"]["1w"]["skew_adj"] <= 0.2
    # p_up_override above the [0.30,0.70] ceiling is rejected -> None
    assert adj["horizons"]["1w"]["p_up_override"] is None


def test_missing_horizon_raises():
    with pytest.raises(ValueError):
        parse_and_clamp({"horizons": {"1w": GOOD["horizons"]["1w"]}})


def test_non_dict_raises():
    with pytest.raises(ValueError):
        parse_and_clamp("not a dict")


def _base():
    return baseline_forecast(spot=60000.0, sigma_daily=0.03, horizon="1w",
                             horizon_days=7, mu_daily=0.0, conf_level=0.60)


def test_zero_adjustment_reproduces_baseline():
    b = _base()
    adj = {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
           "p_up_override": None, "confidence": "medium"}
    f = apply_overlay(b, adj, llm_applied=True)
    assert isinstance(f, EnrichedForecast)
    assert abs(f.central - b.central) < 1e-6
    assert abs(f.lower - b.lower) < 1e-6
    assert abs(f.upper - b.upper) < 1e-6
    assert f.baseline_central == b.central


def test_positive_drift_raises_central_and_p_up():
    b = _base()
    adj = {"drift_adj_bps": 50.0, "vol_mult": 1.0, "skew_adj": 0.0,
           "p_up_override": None, "confidence": "high"}
    f = apply_overlay(b, adj, llm_applied=True)
    assert f.central > b.central
    assert f.p_up > b.p_up
    assert 0.30 <= f.p_up <= 0.70


def test_vol_mult_widens_band():
    b = _base()
    adj = {"drift_adj_bps": 0.0, "vol_mult": 1.5, "skew_adj": 0.0,
           "p_up_override": None, "confidence": "low"}
    f = apply_overlay(b, adj, llm_applied=True)
    assert (f.upper - f.lower) > (b.upper - b.lower)


def test_p_up_override_within_bounds_wins():
    b = _base()
    adj = {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
           "p_up_override": 0.65, "confidence": "high"}
    f = apply_overlay(b, adj, llm_applied=True)
    assert abs(f.p_up - 0.65) < 1e-9


# --- Task 8: run_overlay tests ---
import json
from btc_oracle.baseline import build_baseline_forecasts
from btc_oracle.overlay import run_overlay


def _baselines():
    return build_baseline_forecasts(spot=60000.0, sigma_daily=0.03)


def test_run_overlay_success_applies_and_flags_true():
    payload = {"horizons": {
        "1w": {"drift_adj_bps": 50, "vol_mult": 1.2, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
        "1m": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
        "1y": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
    }, "rationale": "crowded longs", "event_refs": ["evt1"]}
    def fake_claude(system, user):
        return json.dumps(payload)
    forecasts, rationale, applied = run_overlay(_baselines(), "events...", fake_claude)
    assert applied is True
    assert rationale == "crowded longs"
    f1w = next(f for f in forecasts if f.horizon == "1w")
    assert f1w.vol_mult == 1.2 and f1w.drift_adj_bps == 50


def test_run_overlay_falls_back_on_exception():
    def boom(system, user):
        raise RuntimeError("API down")
    forecasts, rationale, applied = run_overlay(_baselines(), "events", boom)
    assert applied is False
    for f in forecasts:
        assert f.vol_mult == 1.0 and f.drift_adj_bps == 0.0  # untouched baseline
    assert "baseline" in rationale.lower()


def test_run_overlay_falls_back_on_bad_json():
    def junk(system, user):
        return "not json at all"
    _, _, applied = run_overlay(_baselines(), "events", junk)
    assert applied is False


def test_run_overlay_falls_back_on_invalid_structure():
    def missing(system, user):
        return json.dumps({"horizons": {"1w": {"vol_mult": 1.0}}})  # missing 1m/1y
    _, _, applied = run_overlay(_baselines(), "events", missing)
    assert applied is False

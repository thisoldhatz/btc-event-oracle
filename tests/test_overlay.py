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

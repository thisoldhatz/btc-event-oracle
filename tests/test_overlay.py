import pytest
from btc_oracle.overlay import parse_and_clamp, DRIFT_CAP_BPS, VOL_MULT_BOUNDS

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

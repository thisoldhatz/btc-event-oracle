import math
from btc_oracle.scoring import crps_normal, score_forecast


def test_crps_normal_basic():
    # CRPS of a point forecast (sigma->0) is the absolute error
    assert abs(crps_normal(2.0, 0.0, 1e-9) - 2.0) < 1e-3
    # CRPS is non-negative and finite
    c = crps_normal(0.05, 0.0, 0.1)
    assert c > 0 and math.isfinite(c)


def test_score_forecast_adds_crps_and_pit_when_vol_given():
    s = score_forecast(p_up=0.6, central=108.0, lower=95.0, upper=120.0,
                       spot_at_issue=100.0, realized=110.0, mu_h=0.0, sigma_h=0.1)
    x = math.log(110.0 / 100.0)
    assert abs(s["crps_rw"] - abs(x)) < 1e-9        # RW = point 0-change -> |log return|
    assert s["crps"] is not None and s["crps"] > 0
    assert 0.0 <= s["pit"] <= 1.0


def test_score_forecast_crps_none_without_vol():
    s = score_forecast(p_up=0.6, central=108.0, lower=95.0, upper=120.0,
                       spot_at_issue=100.0, realized=110.0)
    assert s["crps"] is None and s["pit"] is None     # backward compatible
    assert s["brier"] == (0.6 - 1) ** 2


def test_up_move_scores():
    # spot 100 -> realized 110 (up). Forecast was bullish (p_up 0.7), central 108, band [95,120].
    s = score_forecast(p_up=0.7, central=108.0, lower=95.0, upper=120.0,
                       spot_at_issue=100.0, realized=110.0)
    assert s["up_outcome"] == 1
    assert abs(s["brier"] - (0.7 - 1) ** 2) < 1e-12          # 0.09
    assert abs(s["brier_base"] - (0.5 - 1) ** 2) < 1e-12     # 0.25
    assert abs(s["bss"] - (1 - 0.09 / 0.25)) < 1e-12         # 0.64
    assert abs(s["ae"] - 2.0) < 1e-12                        # |110-108|
    assert abs(s["ape"] - (2.0 / 110.0 * 100)) < 1e-9
    assert abs(s["mae_ratio"] - (2.0 / 10.0)) < 1e-12        # rw error |110-100|=10
    assert s["covered"] == 1                                 # 95<=110<=120


def test_down_move_and_miss_outside_band():
    s = score_forecast(p_up=0.6, central=100.0, lower=98.0, upper=102.0,
                       spot_at_issue=100.0, realized=90.0)
    assert s["up_outcome"] == 0
    assert abs(s["brier"] - 0.36) < 1e-12                    # (0.6-0)^2
    assert s["covered"] == 0                                 # 90 < 98


def test_no_move_counts_as_not_up():
    s = score_forecast(p_up=0.5, central=100.0, lower=90.0, upper=110.0,
                       spot_at_issue=100.0, realized=100.0)
    assert s["up_outcome"] == 0          # strict: realized > spot required for "up"
    assert s["mae_ratio"] is None        # rw error is 0 -> undefined ratio

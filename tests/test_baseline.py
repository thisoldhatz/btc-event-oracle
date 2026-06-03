# tests/test_baseline.py
import math
from statistics import NormalDist
from btc_oracle.baseline import baseline_forecast


def test_zero_drift_centers_on_spot_and_p_up_half():
    f = baseline_forecast(spot=100.0, sigma_daily=0.02, horizon="1w",
                          horizon_days=7, mu_daily=0.0, conf_level=0.60)
    # central = 100*exp(0) = 100
    assert f.central == 100.0
    # mu=0 -> P(up)=Phi(0)=0.5
    assert abs(f.p_up - 0.5) < 1e-12
    assert f.lower < 100.0 < f.upper


def test_sigma_h_scales_with_sqrt_time():
    f = baseline_forecast(spot=100.0, sigma_daily=0.02, horizon="1m",
                          horizon_days=30, mu_daily=0.0, conf_level=0.60)
    assert abs(f.sigma_h - 0.02 * math.sqrt(30)) < 1e-12


def test_band_matches_lognormal_quantiles():
    spot, sig, days, c = 50000.0, 0.03, 7, 0.60
    f = baseline_forecast(spot=spot, sigma_daily=sig, horizon="1w",
                          horizon_days=days, mu_daily=0.0, conf_level=c)
    z = NormalDist().inv_cdf((1 + c) / 2)
    sigma_h = sig * math.sqrt(days)
    assert abs(f.upper - spot * math.exp(z * sigma_h)) < 1e-6
    assert abs(f.lower - spot * math.exp(-z * sigma_h)) < 1e-6


def test_positive_drift_pushes_p_up_above_half():
    f = baseline_forecast(spot=100.0, sigma_daily=0.02, horizon="1y",
                          horizon_days=365, mu_daily=0.0005, conf_level=0.60)
    assert f.p_up > 0.5
    assert f.central > 100.0

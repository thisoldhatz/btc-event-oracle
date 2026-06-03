from btc_oracle.types import HORIZONS, BaselineForecast


def test_horizons_are_the_three_spec_horizons():
    assert HORIZONS == {"1w": 7, "1m": 30, "1y": 365}


def test_baseline_forecast_is_constructible():
    f = BaselineForecast(
        horizon="1w", horizon_days=7, spot=100.0, central=100.0,
        lower=90.0, upper=111.0, conf_level=0.6, p_up=0.5,
        mu_h=0.0, sigma_h=0.1, vol_model="ewma", vol_window=300,
    )
    assert f.horizon == "1w"
    assert f.lower < f.central < f.upper

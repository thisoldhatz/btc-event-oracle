# src/btc_oracle/baseline.py
import math
from statistics import NormalDist
from .types import BaselineForecast

_ND = NormalDist()


def forecast_from_sigma_h(*, spot, sigma_h, horizon, horizon_days, mu_daily=0.0,
                          conf_level=0.60, vol_model="gjr-garch", vol_window=0):
    """Build a BaselineForecast from a pre-computed HORIZON volatility `sigma_h`
    (e.g. from GJR-GARCH) rather than scaling a daily sigma by sqrt(time)."""
    if sigma_h <= 0:
        raise ValueError("sigma_h must be positive")
    mu_h = mu_daily * horizon_days
    central = spot * math.exp(mu_h)
    z = _ND.inv_cdf((1 + conf_level) / 2)
    lower = spot * math.exp(mu_h - z * sigma_h)
    upper = spot * math.exp(mu_h + z * sigma_h)
    p_up = _ND.cdf(mu_h / sigma_h)
    return BaselineForecast(
        horizon=horizon, horizon_days=horizon_days, spot=spot, central=central,
        lower=lower, upper=upper, conf_level=conf_level, p_up=p_up, mu_h=mu_h,
        sigma_h=sigma_h, vol_model=vol_model, vol_window=vol_window,
    )


def baseline_forecast(
    *, spot: float, sigma_daily: float, horizon: str, horizon_days: int,
    mu_daily: float = 0.0, conf_level: float = 0.60,
    vol_model: str = "ewma", vol_window: int = 0,
) -> BaselineForecast:
    """Lognormal random-walk baseline (spec §6a). MVP uses Normal quantiles."""
    if sigma_daily <= 0:
        raise ValueError("sigma_daily must be positive")
    mu_h = mu_daily * horizon_days
    sigma_h = sigma_daily * math.sqrt(horizon_days)
    central = spot * math.exp(mu_h)
    z = _ND.inv_cdf((1 + conf_level) / 2)
    lower = spot * math.exp(mu_h - z * sigma_h)
    upper = spot * math.exp(mu_h + z * sigma_h)
    p_up = _ND.cdf(mu_h / sigma_h)
    return BaselineForecast(
        horizon=horizon, horizon_days=horizon_days, spot=spot, central=central,
        lower=lower, upper=upper, conf_level=conf_level, p_up=p_up,
        mu_h=mu_h, sigma_h=sigma_h, vol_model=vol_model, vol_window=vol_window,
    )


def build_baseline_forecasts(
    *, spot: float, sigma_daily: float, mu_daily: float = 0.0,
    conf_level: float = 0.60, vol_model: str = "ewma", vol_window: int = 0,
) -> list[BaselineForecast]:
    """One BaselineForecast per horizon in HORIZONS."""
    from .types import HORIZONS
    return [
        baseline_forecast(
            spot=spot, sigma_daily=sigma_daily, horizon=h, horizon_days=days,
            mu_daily=mu_daily, conf_level=conf_level,
            vol_model=vol_model, vol_window=vol_window,
        )
        for h, days in HORIZONS.items()
    ]

# src/btc_oracle/baseline.py
import math
from statistics import NormalDist
from .types import BaselineForecast

_ND = NormalDist()


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

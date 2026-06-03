from dataclasses import dataclass

# Horizon label -> number of days. Frozen per spec §14.
HORIZONS: dict[str, int] = {"1w": 7, "1m": 30, "1y": 365}


@dataclass(frozen=True)
class BaselineForecast:
    horizon: str
    horizon_days: int
    spot: float          # P0 at issue
    central: float       # median price P0*exp(mu_h)
    lower: float
    upper: float
    conf_level: float    # e.g. 0.60
    p_up: float          # directional probability
    mu_h: float          # horizon log-drift
    sigma_h: float       # horizon log-vol
    vol_model: str       # "ewma"
    vol_window: int      # number of returns used

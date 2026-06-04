import numpy as np


def _persistence_ok(params: dict) -> bool:
    """Reject explosive / non-stationary or non-finite GJR-GARCH fits. A
    near-unit-root persistence (alpha + gamma/2 + beta -> 1) makes the H-day
    variance sum diverge, silently blowing out the flagship 1y band; falling
    back to EWMA is far safer than publishing an absurd interval."""
    vals = [float(v) for v in params.values()]
    if not all(np.isfinite(vals)):
        return False

    def _sum(prefix: str) -> float:
        return sum(float(v) for k, v in params.items() if k.startswith(prefix))

    persistence = _sum("alpha") + 0.5 * _sum("gamma") + _sum("beta")
    return 0.0 <= persistence < 0.999


def garch_sigma_h(returns, horizon_days: int, *, min_obs: int = 100):
    """GJR-GARCH(1,1) total H-day log-return volatility: the square root of the
    SUM of forecasted daily variances (the proper mean-reverting term structure,
    better than naive sqrt-time). Returns None on too-little-data or any fit
    failure, so the caller falls back to EWMA. Asymmetric (o=1) per the verified
    out-of-sample winner for crypto."""
    try:
        r = np.asarray(list(returns), dtype=float)
        if r.size < min_obs:
            return None
        from arch import arch_model
        # arch is numerically happier with percent returns; convert variance back after.
        am = arch_model(r * 100.0, mean="Zero", vol="GARCH", p=1, o=1, q=1, dist="normal")
        res = am.fit(disp="off", show_warning=False)
        if not _persistence_ok({k: float(v) for k, v in res.params.items()}):
            return None
        fc = res.forecast(horizon=horizon_days, reindex=False)
        daily_var_pct2 = np.asarray(fc.variance.values[0], dtype=float)  # %^2 per day
        total_var = float(np.sum(daily_var_pct2)) / (100.0 ** 2)         # -> log-return^2
        if not np.isfinite(total_var) or total_var <= 0:
            return None
        return float(np.sqrt(total_var))
    except Exception:
        return None

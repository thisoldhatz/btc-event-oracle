import math
from statistics import NormalDist

_ND = NormalDist()


def crps_normal(x: float, mu: float, sigma: float) -> float:
    """Closed-form CRPS of a Normal(mu, sigma) predictive distribution at outcome x.
    Lower is better; reduces to |x - mu| as sigma -> 0."""
    if sigma <= 0:
        return abs(x - mu)
    z = (x - mu) / sigma
    return sigma * (z * (2 * _ND.cdf(z) - 1) + 2 * _ND.pdf(z) - 1.0 / math.sqrt(math.pi))


def score_forecast(*, p_up, central, lower, upper, spot_at_issue, realized,
                   mu_h=None, sigma_h=None) -> dict:
    """Proper-scoring of one matured forecast vs the random-walk benchmark (spec §7).
    'up' is strict: realized > spot_at_issue.
    Optional mu_h/sigma_h (log-return distribution params) enable CRPS and PIT computation."""
    up = 1 if realized > spot_at_issue else 0
    brier = (p_up - up) ** 2
    brier_base = (0.5 - up) ** 2
    bss = (1.0 - brier / brier_base) if brier_base > 0 else None
    ae = abs(realized - central)
    ape = (ae / realized * 100.0) if realized else None
    rw_ae = abs(realized - spot_at_issue)
    mae_ratio = (ae / rw_ae) if rw_ae > 0 else None          # < 1 means we beat random walk
    covered = 1 if lower <= realized <= upper else 0
    crps = crps_rw = pit = None
    if mu_h is not None and sigma_h is not None and realized > 0 and spot_at_issue > 0:
        x = math.log(realized / spot_at_issue)          # realized log-return
        crps = crps_normal(x, mu_h, sigma_h)
        crps_rw = abs(x)                                  # random walk = deterministic 0 change
        pit = _ND.cdf((x - mu_h) / sigma_h) if sigma_h > 0 else None
    return {"up_outcome": up, "brier": brier, "brier_base": brier_base, "bss": bss,
            "ae": ae, "ape": ape, "mae_ratio": mae_ratio, "covered": covered,
            "crps": crps, "crps_rw": crps_rw, "pit": pit}

"""Diebold-Mariano test of predictive accuracy vs the random-walk benchmark.

The accuracy scorecard otherwise rests on point estimates plus an iid Brier CI —
but hourly forecasts of the same horizon overlap heavily, so their loss
differentials are autocorrelated and that naive CI is too narrow (it OVERSTATES
confidence). DM with a Newey-West (Bartlett) HAC long-run variance corrects for
that. We default to "not significant" and only ever claim skill when the test
clears it, which is exactly the honest, anti-overclaiming framing the product
needs. (p-value is the asymptotic normal two-sided value.)"""
import math
from statistics import NormalDist

_ND = NormalDist()


def _autocov(x, k):
    n = len(x)
    m = sum(x) / n
    return sum((x[i] - m) * (x[i - k] - m) for i in range(k, n)) / n


def _newey_west_lrv(d, lag):
    """Bartlett-kernel long-run variance of the loss-differential series."""
    lrv = _autocov(d, 0)
    for k in range(1, lag + 1):
        lrv += 2.0 * (1.0 - k / (lag + 1)) * _autocov(d, k)
    return lrv


def diebold_mariano(loss_model, loss_bench, lag=None):
    """Test H0: E[loss_model - loss_bench] = 0. Returns a dict (or None when N is
    too small / the series has no variance). `favors`='model' means our model has
    the lower mean loss; `significant` is the two-sided p < 0.05 verdict."""
    d = [a - b for a, b in zip(loss_model, loss_bench)]
    n = len(d)
    if n < 8:
        return None
    if lag is None:  # data-driven Newey-West bandwidth
        lag = max(1, int(4 * (n / 100.0) ** (2.0 / 9.0)))
    lag = min(lag, n - 1)
    g0 = _autocov(d, 0)
    lrv = _newey_west_lrv(d, lag)
    if lrv <= 0:  # HAC estimates can go non-positive; fall back to the iid variance
        lrv = g0
    if lrv <= 0:  # genuinely no variability -> the test is undefined
        return None
    d_bar = sum(d) / n
    dm = d_bar / math.sqrt(lrv / n)
    p = 2.0 * (1.0 - _ND.cdf(abs(dm)))
    favors = "model" if d_bar < 0 else ("random walk" if d_bar > 0 else "neither")
    return {"dm": dm, "p_value": p, "n": n, "mean_diff": d_bar, "lag": lag,
            "favors": favors, "significant": p < 0.05}

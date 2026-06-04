import numpy as np
from btc_oracle.garch import garch_sigma_h


def _returns(n=400, seed=0):
    return list(np.random.default_rng(seed).normal(0.0, 0.03, n))


def test_returns_positive_and_grows_with_horizon():
    r = _returns()
    s7 = garch_sigma_h(r, 7)
    s30 = garch_sigma_h(r, 30)
    assert s7 is not None and s30 is not None
    assert s7 > 0 and s30 > s7                 # total variance accumulates over more days
    # sanity: a ~3%/day series over 7 days has sigma roughly in a plausible band
    assert 0.02 < s7 < 0.5


def test_fail_soft_on_too_little_data():
    assert garch_sigma_h([0.01, -0.01, 0.02], 7) is None
    assert garch_sigma_h([], 7) is None

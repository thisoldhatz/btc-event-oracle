# tests/test_returns.py
import math
import pytest
from btc_oracle.returns import log_returns, ewma_volatility


def test_log_returns_basic():
    r = log_returns([100.0, 110.0, 99.0])
    assert len(r) == 2
    assert abs(r[0] - math.log(110/100)) < 1e-12
    assert abs(r[1] - math.log(99/110)) < 1e-12


def test_log_returns_needs_two_prices():
    with pytest.raises(ValueError):
        log_returns([100.0])


def test_ewma_recovers_constant_volatility():
    # constant |return| series -> EWMA vol converges to that magnitude
    rets = [0.02, -0.02] * 200
    vol = ewma_volatility(rets, lam=0.94)
    assert abs(vol - 0.02) < 1e-3


def test_ewma_reacts_to_recent_spike():
    calm = [0.001] * 100
    spike = calm + [0.10]
    assert ewma_volatility(spike, lam=0.94) > ewma_volatility(calm, lam=0.94)


def test_ewma_needs_two_returns():
    with pytest.raises(ValueError):
        ewma_volatility([0.01], lam=0.94)

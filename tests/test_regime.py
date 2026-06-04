import numpy as np
from btc_oracle.regime import detect_regime


def test_calm_series_is_normal():
    calm = [0.001] * 200
    label, pct, widen = detect_regime(calm)
    assert label == "normal" and widen == 1.0


def test_recent_vol_spike_is_high_and_widens():
    rng = np.random.default_rng(1)
    series = list(rng.normal(0, 0.005, 200)) + list(rng.normal(0, 0.06, 20))  # calm then turbulent
    label, pct, widen = detect_regime(series)
    assert label in ("elevated", "high")
    assert widen > 1.0 and pct > 0.6


def test_short_series_defaults_normal():
    label, pct, widen = detect_regime([0.01, -0.01])
    assert label == "normal" and widen == 1.0

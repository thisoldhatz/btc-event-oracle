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


def test_widen_never_narrows_invariant():
    """Regime detection ONLY widens intervals — widen_mult is always >= 1.0 for
    every possible output, guarding against future regressions."""
    rng = np.random.default_rng(42)
    test_cases = [
        [0.001] * 200,                                          # constant-ish (normal)
        list(rng.normal(0, 0.02, 200)),                         # typical vol (normal)
        list(rng.normal(0, 0.005, 200)) + list(rng.normal(0, 0.04, 20)),  # mild spike (elevated)
        list(rng.normal(0, 0.005, 200)) + list(rng.normal(0, 0.06, 20)),  # large spike (high)
        [0.01, -0.01],                                          # too short -> default normal
    ]
    for series in test_cases:
        _, _, widen = detect_regime(series)
        assert widen >= 1.0, f"widen_mult {widen} < 1.0 — intervals were narrowed!"

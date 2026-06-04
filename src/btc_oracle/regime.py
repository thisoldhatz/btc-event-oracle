import numpy as np


def detect_regime(returns, window: int = 14):
    """Classify the current volatility regime by the percentile of trailing
    `window`-day realized volatility vs the full history. In turbulent regimes we
    WIDEN published intervals (never narrow) — GARCH accuracy provably degrades in
    high-vol/systemic-event periods, so honest uncertainty must grow.
    Returns (label, percentile, widen_mult).

    widen_mult is ALWAYS >= 1.0 (the three possible values are 1.0, 1.07, 1.15).
    The regime detection only widens intervals in turbulence; it never narrows them
    dishonestly, which would understate uncertainty.

    Constant-series guard: if all rolling window std-devs are near zero (flat price
    series), pct would be 1.0 and the wrong label 'high' would be assigned. We
    detect this degenerate case and return 'normal' directly — a flat series is the
    calmest possible market, not a turbulent one.
    """
    r = np.asarray(list(returns), dtype=float)
    if r.size < window + 30:
        return ("normal", 0.5, 1.0)
    rolling = np.array([r[i - window:i].std() for i in range(window, r.size + 1)])
    current = rolling[-1]
    # Degenerate case: constant (or near-constant) series has negligible vol → calmest regime.
    # Without this guard, np.mean(rolling <= current) == 1.0 → label 'high' (incorrect).
    if rolling.max() < 1e-10:
        return ("normal", 0.0, 1.0)
    pct = float(np.mean(rolling <= current))
    if pct >= 0.85:
        return ("high", pct, 1.15)
    if pct >= 0.65:
        return ("elevated", pct, 1.07)
    return ("normal", pct, 1.0)

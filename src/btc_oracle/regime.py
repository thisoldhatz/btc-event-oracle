import numpy as np


def detect_regime(returns, window: int = 14):
    """Classify the current volatility regime by the percentile of trailing
    `window`-day realized volatility vs the full history. In turbulent regimes we
    WIDEN published intervals (never narrow) — GARCH accuracy provably degrades in
    high-vol/systemic-event periods, so honest uncertainty must grow.
    Returns (label, percentile, widen_mult)."""
    r = np.asarray(list(returns), dtype=float)
    if r.size < window + 30:
        return ("normal", 0.5, 1.0)
    rolling = np.array([r[i - window:i].std() for i in range(window, r.size + 1)])
    current = rolling[-1]
    # Degenerate case: constant (or near-constant) series has negligible vol → calmest regime.
    if rolling.max() < 1e-10:
        return ("normal", 0.0, 1.0)
    pct = float(np.mean(rolling <= current))
    if pct >= 0.85:
        return ("high", pct, 1.15)
    if pct >= 0.65:
        return ("elevated", pct, 1.07)
    return ("normal", pct, 1.0)

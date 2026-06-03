# src/btc_oracle/returns.py
import math


def log_returns(closes: list[float]) -> list[float]:
    if len(closes) < 2:
        raise ValueError("need at least 2 closes")
    return [math.log(closes[i] / closes[i - 1]) for i in range(1, len(closes))]


def ewma_volatility(returns: list[float], lam: float = 0.94) -> float:
    """RiskMetrics EWMA daily vol. Seeds variance with the sample variance,
    then exponentially updates. Returns sigma_daily (std of log returns)."""
    if len(returns) < 2:
        raise ValueError("need at least 2 returns")
    if not (0.0 < lam < 1.0):
        raise ValueError("lam must be in (0, 1)")
    mean = sum(returns) / len(returns)
    var = sum((r - mean) ** 2 for r in returns) / len(returns)  # seed
    for r in returns:
        var = lam * var + (1.0 - lam) * r * r
    return math.sqrt(var)

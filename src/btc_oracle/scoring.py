def score_forecast(*, p_up, central, lower, upper, spot_at_issue, realized) -> dict:
    """Proper-scoring of one matured forecast vs the random-walk benchmark (spec §7).
    'up' is strict: realized > spot_at_issue."""
    up = 1 if realized > spot_at_issue else 0
    brier = (p_up - up) ** 2
    brier_base = (0.5 - up) ** 2
    bss = (1.0 - brier / brier_base) if brier_base > 0 else None
    ae = abs(realized - central)
    ape = (ae / realized * 100.0) if realized else None
    rw_ae = abs(realized - spot_at_issue)
    mae_ratio = (ae / rw_ae) if rw_ae > 0 else None          # < 1 means we beat random walk
    covered = 1 if lower <= realized <= upper else 0
    return {"up_outcome": up, "brier": brier, "brier_base": brier_base, "bss": bss,
            "ae": ae, "ape": ape, "mae_ratio": mae_ratio, "covered": covered}

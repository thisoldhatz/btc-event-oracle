# src/btc_oracle/snapshots.py
import json
import os
from .types import HORIZONS
from .store import (get_latest_run_with_forecasts, get_forecasts_for_run, get_forecast_history,
                    get_scores, get_timeline, get_results, get_scored_detail)
from .scoring import crps_normal

_F_KEYS = ("horizon", "target_at", "central", "lower", "upper", "conf_level",
           "p_up", "confidence_label", "band_width_pct", "drift_adj_bps",
           "vol_mult", "rationale")


def event_to_signal(e) -> dict:
    return {"source": e.source, "signal": e.signal, "value": e.value,
            "delta": e.delta, "interpretation": e.interpretation,
            "observed_at": e.observed_at}


def build_latest(conn, signals: list | None = None, news: list | None = None,
                 regime: dict | None = None, markets: list | None = None) -> dict:
    _regime = regime or {"label": "normal", "percentile": 0.5}
    run = get_latest_run_with_forecasts(conn)
    if run is None:
        return {"run_at": None, "spot": None, "llm_applied": False,
                "model_id": None, "forecasts": [], "signals": signals or [],
                "news": news or [], "regime": _regime, "markets": markets or []}
    forecasts = [{k: f[k] for k in _F_KEYS} for f in get_forecasts_for_run(conn, run["run_id"])]
    return {"run_at": run["run_at"], "spot": run["spot_at_issue"],
            "llm_applied": bool(run["llm_applied"]), "model_id": run["model_id"],
            "forecasts": forecasts, "signals": signals or [], "news": news or [],
            "regime": _regime, "markets": markets or []}


def build_history(conn, limit: int = 1000) -> dict:
    out = {}
    for h in HORIZONS:
        rows = get_forecast_history(conn, h, limit)
        out[h] = [{"run_at": r["run_at"], "target_at": r["target_at"], "central": r["central"],
                   "lower": r["lower"], "upper": r["upper"], "p_up": r["p_up"]} for r in rows]
    return out


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return (sum(xs) / len(xs)) if xs else None


def _window(rows):
    """Aggregate one list of scored-detail rows into a metrics dict."""
    n = len(rows)
    if n == 0:
        return {"n": 0}
    brier = _mean([r["brier"] for r in rows])
    brier_base = _mean([r["brier_base"] for r in rows])
    crps = _mean([r["crps"] for r in rows])
    crps_rw = _mean([r["crps_rw"] for r in rows])
    apes = [r["ape"] for r in rows if r["ape"] is not None]
    briers = [r["brier"] for r in rows if r["brier"] is not None]
    # normal-approx 95% CI half-width on mean Brier
    if len(briers) > 1:
        m = sum(briers) / len(briers)
        var = sum((b - m) ** 2 for b in briers) / (len(briers) - 1)
        brier_ci = 1.96 * (var ** 0.5) / (len(briers) ** 0.5)
    else:
        brier_ci = None
    return {
        "n": n,
        "brier": brier, "brier_base": brier_base,
        "bss": (1.0 - brier / brier_base) if (brier is not None and brier_base) else None,
        "crps": crps, "crps_rw": crps_rw,
        "crpss": (1.0 - crps / crps_rw) if (crps is not None and crps_rw) else None,
        "mape": (sum(apes) / len(apes)) if apes else None,
        "coverage": _mean([r["covered"] for r in rows]),
        "coverage_nominal": _mean([r["conf_level"] for r in rows]),
        "brier_ci": brier_ci,
    }


def _decomposition(rows, bins=5):
    """Brier reliability/resolution/uncertainty over (p_up, up_outcome) pairs."""
    n = len(rows)
    if n == 0:
        return (None, None, None)
    base = sum(r["up_outcome"] for r in rows) / n            # climatology
    uncertainty = base * (1 - base)
    reliability = resolution = 0.0
    for k in range(bins):
        lo, hi = k / bins, (k + 1) / bins
        grp = [r for r in rows if (lo <= r["p_up"] < hi) or (k == bins - 1 and r["p_up"] == 1.0)]
        if not grp:
            continue
        nk = len(grp)
        pbar = sum(r["p_up"] for r in grp) / nk
        obar = sum(r["up_outcome"] for r in grp) / nk
        reliability += nk / n * (pbar - obar) ** 2
        resolution += nk / n * (obar - base) ** 2
    return (reliability, resolution, uncertainty)


def _calibration(rows, rel_bins=10, pit_bins=10):
    """Chartable calibration data the dashboard currently throws away:
    (1) reliability points — mean predicted P(up) vs observed up-rate per bin
        (only populated bins are emitted, so the P(up) clamp's empty extreme bins
        never read as miscalibration); plot vs the 45-deg line.
    (2) a PIT histogram from the stored probability-integral-transform values
        (distribution calibration — flat == well-calibrated), with a chi-square
        uniformity statistic and the mean PIT."""
    reliability = []
    for k in range(rel_bins):
        lo, hi = k / rel_bins, (k + 1) / rel_bins
        grp = [r for r in rows if (lo <= r["p_up"] < hi) or (k == rel_bins - 1 and r["p_up"] == 1.0)]
        if not grp:
            continue
        nk = len(grp)
        reliability.append({"p": sum(r["p_up"] for r in grp) / nk,
                            "o": sum(r["up_outcome"] for r in grp) / nk, "n": nk})
    pits = [r["pit"] for r in rows if r["pit"] is not None]
    counts = [0] * pit_bins
    for p in pits:
        counts[min(max(int(p * pit_bins), 0), pit_bins - 1)] += 1
    pit_hist = ([{"lo": k / pit_bins, "hi": (k + 1) / pit_bins,
                  "count": c, "freq": c / len(pits)} for k, c in enumerate(counts)]
                if pits else [])
    pit_chi2 = None
    if len(pits) >= pit_bins:
        exp = len(pits) / pit_bins
        pit_chi2 = sum((c - exp) ** 2 / exp for c in counts)
    return {"reliability": reliability, "pit_hist": pit_hist,
            "mean_pit": (sum(pits) / len(pits)) if pits else None,
            "pit_n": len(pits), "pit_chi2": pit_chi2}


def _ab(rows):
    """Overlay (applied) vs baseline (pre-LLM) on Brier + CRPS, using stored baseline_* fields."""
    n = len(rows)
    if n == 0:
        return {"n": 0}
    import math as _m
    model_brier = _mean([(r["p_up"] - r["up_outcome"]) ** 2 for r in rows])
    base_brier = _mean([(r["baseline_p_up"] - r["up_outcome"]) ** 2 for r in rows])

    def _crps_base(r):
        if r["baseline_sigma_h"] and r["spot_at_issue"] > 0 and r["realized_price"] > 0:
            x = _m.log(r["realized_price"] / r["spot_at_issue"])
            mu = _m.log(r["baseline_central"] / r["spot_at_issue"]) if r["baseline_central"] > 0 else 0.0
            return crps_normal(x, mu, r["baseline_sigma_h"])
        return None
    return {"n": n, "model_brier": model_brier, "baseline_brier": base_brier,
            "model_crps": _mean([r["crps"] for r in rows]),
            "baseline_crps": _mean([_crps_base(r) for r in rows])}


def build_scores(conn) -> dict:
    out = {}
    for h in HORIZONS:
        rows = get_scored_detail(conn, h)
        if not rows:
            out[h] = {"n": 0}
            continue
        agg = _window(rows)
        rel, res, unc = _decomposition(rows)
        agg.update({
            "reliability": rel, "resolution": res, "uncertainty": unc,
            "calibration": _calibration(rows),
            "windows": {"all": _window(rows), "last30": _window(rows[:30]), "last90": _window(rows[:90])},
            "ab": _ab(rows),
        })
        out[h] = agg
    return out


def build_market_headtohead(conn) -> dict:
    """Resolved model-vs-market scoring for the head-to-head: per-market Brier for
    both, plus an aggregate 'who's been closer'. n=0 until markets resolve."""
    from .store import get_resolved_markets
    rows = get_resolved_markets(conn)
    items = [{"question": r["question"], "threshold": r["threshold"], "direction": r["direction"],
              "end_date": r["end_date"], "outcome": r["outcome"], "market_prob": r["market_prob"],
              "model_prob": r["model_prob"], "market_brier": r["market_brier"],
              "model_brier": r["model_brier"]} for r in rows]
    scored = [i for i in items if i["market_brier"] is not None and i["model_brier"] is not None]
    n = len(scored)
    agg = {"n": n, "items": items[:20]}
    if n:
        agg["model_brier"] = sum(i["model_brier"] for i in scored) / n
        agg["market_brier"] = sum(i["market_brier"] for i in scored) / n
        agg["model_closer"] = sum(1 for i in scored if i["model_brier"] < i["market_brier"])
        agg["market_closer"] = sum(1 for i in scored if i["market_brier"] < i["model_brier"])
    return agg


def build_extras(conn) -> dict:
    timeline = [
        {"run_at": x["run_at"], "p_up": x["p_up"], "central": x["central"],
         "drift_adj_bps": x["drift_adj_bps"], "vol_mult": x["vol_mult"],
         "confidence_label": x["confidence_label"], "llm_applied": bool(x["llm_applied"]),
         "rationale": x["rationale"]}
        for x in get_timeline(conn)
    ]
    results = [
        {"horizon": x["horizon"], "run_at": x["run_at"], "target_at": x["target_at"],
         "central": x["central"], "lower": x["lower"], "upper": x["upper"], "p_up": x["p_up"],
         "spot_at_issue": x["spot_at_issue"], "realized_price": x["realized_price"],
         "up_outcome": x["up_outcome"],
         "covered": (bool(x["covered"]) if x["covered"] is not None else None)}
        for x in get_results(conn)
    ]
    return {"timeline": timeline, "results": results,
            "market_headtohead": build_market_headtohead(conn)}


def write_snapshots(conn, out_dir: str, signals: list | None = None,
                    news: list | None = None, regime: dict | None = None,
                    markets: list | None = None) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    payloads = {"latest.json": build_latest(conn, signals=signals, news=news, regime=regime, markets=markets),
                "history.json": build_history(conn),
                "scores.json": build_scores(conn),
                "extras.json": build_extras(conn)}
    for name, payload in payloads.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)
    latest_payload = payloads["latest.json"]
    extra_files = []
    try:
        from .og import render_og_card
        render_og_card(latest_payload, os.path.join(out_dir, "og.png"))
        extra_files.append("og.png")
    except Exception:
        pass
    try:
        from .feed import build_rss
        with open(os.path.join(out_dir, "rss.xml"), "w", encoding="utf-8") as fh:
            fh.write(build_rss(latest_payload))
        extra_files.append("rss.xml")
    except Exception:
        pass
    return list(payloads.keys()) + extra_files

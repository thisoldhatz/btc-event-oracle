# src/btc_oracle/snapshots.py
import json
import os
from .types import HORIZONS
from .store import (get_latest_run, get_forecasts_for_run, get_forecast_history, get_scores,
                    get_timeline, get_results)

_F_KEYS = ("horizon", "target_at", "central", "lower", "upper", "conf_level",
           "p_up", "confidence_label", "band_width_pct", "drift_adj_bps",
           "vol_mult", "rationale")


def event_to_signal(e) -> dict:
    return {"source": e.source, "signal": e.signal, "value": e.value,
            "delta": e.delta, "interpretation": e.interpretation,
            "observed_at": e.observed_at}


def build_latest(conn, signals: list | None = None, news: list | None = None,
                 regime: dict | None = None) -> dict:
    _regime = regime or {"label": "normal", "percentile": 0.5}
    run = get_latest_run(conn)
    if run is None:
        return {"run_at": None, "spot": None, "llm_applied": False,
                "model_id": None, "forecasts": [], "signals": signals or [],
                "news": news or [], "regime": _regime}
    forecasts = [{k: f[k] for k in _F_KEYS} for f in get_forecasts_for_run(conn, run["run_id"])]
    return {"run_at": run["run_at"], "spot": run["spot_at_issue"],
            "llm_applied": bool(run["llm_applied"]), "model_id": run["model_id"],
            "forecasts": forecasts, "signals": signals or [], "news": news or [],
            "regime": _regime}


def build_history(conn, limit: int = 1000) -> dict:
    out = {}
    for h in HORIZONS:
        rows = get_forecast_history(conn, h, limit)
        out[h] = [{"run_at": r["run_at"], "target_at": r["target_at"], "central": r["central"],
                   "lower": r["lower"], "upper": r["upper"], "p_up": r["p_up"]} for r in rows]
    return out


def build_scores(conn) -> dict:
    out = {}
    for h in HORIZONS:
        rows = get_scores(conn, h)
        n = len(rows)
        if n == 0:
            out[h] = {"n": 0}
            continue
        brier = sum(r["brier"] for r in rows) / n
        brier_base = sum(r["brier_base"] for r in rows) / n
        apes = [r["ape"] for r in rows if r["ape"] is not None]
        out[h] = {
            "n": n,
            "brier": brier,
            "brier_base": brier_base,
            "bss": (1.0 - brier / brier_base) if brier_base > 0 else None,
            "mape": (sum(apes) / len(apes)) if apes else None,
            "coverage": sum(r["covered"] for r in rows) / n,
        }
    return out


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
    return {"timeline": timeline, "results": results}


def write_snapshots(conn, out_dir: str, signals: list | None = None,
                    news: list | None = None, regime: dict | None = None) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    payloads = {"latest.json": build_latest(conn, signals=signals, news=news, regime=regime),
                "history.json": build_history(conn),
                "scores.json": build_scores(conn),
                "extras.json": build_extras(conn)}
    for name, payload in payloads.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)
    return list(payloads.keys())

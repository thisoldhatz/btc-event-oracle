# src/btc_oracle/snapshots.py
import json
import os
from .types import HORIZONS
from .store import (get_latest_run, get_forecasts_for_run, get_forecast_history, get_scores)

_F_KEYS = ("horizon", "target_at", "central", "lower", "upper", "conf_level",
           "p_up", "confidence_label", "band_width_pct", "drift_adj_bps",
           "vol_mult", "rationale")


def build_latest(conn) -> dict:
    run = get_latest_run(conn)
    if run is None:
        return {"run_at": None, "spot": None, "llm_applied": False,
                "model_id": None, "forecasts": []}
    forecasts = [{k: f[k] for k in _F_KEYS} for f in get_forecasts_for_run(conn, run["run_id"])]
    return {"run_at": run["run_at"], "spot": run["spot_at_issue"],
            "llm_applied": bool(run["llm_applied"]), "model_id": run["model_id"],
            "forecasts": forecasts}


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


def write_snapshots(conn, out_dir: str) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    payloads = {"latest.json": build_latest(conn),
                "history.json": build_history(conn),
                "scores.json": build_scores(conn)}
    for name, payload in payloads.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)
    return list(payloads.keys())

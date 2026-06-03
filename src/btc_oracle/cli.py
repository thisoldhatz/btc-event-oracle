# src/btc_oracle/cli.py
import argparse

import ccxt
import httpx

from .config import get_settings
from .store import connect, init_schema, get_closes
from .returns import log_returns, ewma_volatility
from .baseline import build_baseline_forecasts
from .prices import backfill, fetch_spot
from .events import collect_events, condense
from .overlay import run_overlay
from .llm import make_claude_call


def compute_current_baseline(conn, settings, spot, source="coinbase", interval="1d"):
    closes = get_closes(conn, source, interval)
    rets = log_returns(closes)
    sigma_daily = ewma_volatility(rets, lam=settings.vol_lambda)
    return build_baseline_forecasts(
        spot=spot, sigma_daily=sigma_daily, mu_daily=settings.mu_daily,
        conf_level=settings.conf_level, vol_model="ewma", vol_window=len(rets),
    )


def _httpx_get(url, params, headers):
    return httpx.get(url, params=params, headers=headers, timeout=20).json()


def _noop_claude(system, user):
    # Used when no API key is configured: forces the honest baseline-only path.
    raise RuntimeError("no LLM configured")


def build_enriched_forecasts(conn, settings, spot, http_get, claude_call):
    """Baseline -> live events -> bounded Claude overlay (or fallback).
    Returns (forecasts, rationale, llm_applied, events)."""
    baselines = compute_current_baseline(conn, settings, spot=spot)
    events = collect_events(http_get)
    call = claude_call if claude_call is not None else _noop_claude
    forecasts, rationale, applied = run_overlay(baselines, condense(events), call)
    return forecasts, rationale, applied, events


def cmd_preview(settings):
    conn = connect(settings.db_path)
    init_schema(conn)
    spot = fetch_spot(_httpx_get, demo_key=settings.coingecko_demo_key)
    claude_call = (make_claude_call(settings.anthropic_api_key)
                   if settings.anthropic_api_key else None)
    forecasts, rationale, applied, events = build_enriched_forecasts(
        conn, settings, spot=spot, http_get=_httpx_get, claude_call=claude_call)
    print(f"spot={spot:,.0f}  llm_applied={applied}  events={len(events)}")
    for f in forecasts:
        print(f"{f.horizon:>3} [{f.confidence_label:>6}]: central={f.central:,.0f} "
              f"[{f.lower:,.0f} - {f.upper:,.0f}] P(up)={f.p_up:.0%} "
              f"(driftbps={f.drift_adj_bps:+.0f} volx={f.vol_mult:.2f})")
    print(f"rationale: {rationale}")


def cmd_backfill(settings):
    conn = connect(settings.db_path)
    init_schema(conn)
    ex = ccxt.coinbase()
    n = backfill(conn, ex, source="coinbase", symbol="BTC/USD", timeframe="1d")
    print(f"backfill: inserted {n} new daily candles")


def cmd_baseline(settings):
    conn = connect(settings.db_path)
    init_schema(conn)
    spot = fetch_spot(_httpx_get, demo_key=settings.coingecko_demo_key)
    for f in compute_current_baseline(conn, settings, spot=spot):
        print(f"{f.horizon:>3}: central={f.central:,.0f} "
              f"[{f.lower:,.0f} - {f.upper:,.0f}] P(up)={f.p_up:.0%}")


def main(argv=None):
    p = argparse.ArgumentParser(prog="btc-oracle")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("backfill", help="ingest BTC daily history")
    sub.add_parser("baseline", help="print current baseline forecasts")
    sub.add_parser("preview", help="print event-aware (overlay) forecasts")
    args = p.parse_args(argv)
    settings = get_settings()
    {"backfill": cmd_backfill, "baseline": cmd_baseline, "preview": cmd_preview}[args.cmd](settings)


if __name__ == "__main__":
    main()

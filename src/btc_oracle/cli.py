# src/btc_oracle/cli.py
import argparse

import ccxt
import httpx

from .config import get_settings
from .store import connect, init_schema, get_closes
from .returns import log_returns, ewma_volatility
from .baseline import build_baseline_forecasts
from .prices import backfill, fetch_spot


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
              f"[{f.lower:,.0f} – {f.upper:,.0f}] P(up)={f.p_up:.0%}")


def main(argv=None):
    p = argparse.ArgumentParser(prog="btc-oracle")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("backfill", help="ingest BTC daily history")
    sub.add_parser("baseline", help="print current baseline forecasts")
    args = p.parse_args(argv)
    settings = get_settings()
    {"backfill": cmd_backfill, "baseline": cmd_baseline}[args.cmd](settings)


if __name__ == "__main__":
    main()

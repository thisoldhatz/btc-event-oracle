from types import SimpleNamespace
import datetime

from btc_oracle.market_scoring import (parse_market, model_implied_prob,
                                       capture_markets, resolve_markets)
from btc_oracle.store import insert_prices, get_resolved_markets


def test_parse_market_threshold_and_direction():
    assert parse_market("Will Bitcoin be above $62,000 on June 4?") == (62000.0, "above")
    assert parse_market("Will BTC dip below $50,000 this week?") == (50000.0, "below")
    t, d = parse_market("Will Bitcoin reach $70k by Friday?")
    assert t == 70000.0 and d == "above"
    assert parse_market("Who wins the 2026 election?") == (None, None)
    assert parse_market("Bitcoin above $5 forever?") == (None, None)   # implausible threshold


def test_model_implied_prob_is_a_calibrated_complement():
    p = model_implied_prob(70000, "above", 65000, 0.0, 0.05, 7, 7)
    assert 0.0 < p < 0.45                                # 70k is above spot -> below a coin-flip
    pb = model_implied_prob(70000, "below", 65000, 0.0, 0.05, 7, 7)
    assert abs((p + pb) - 1.0) < 1e-9                    # above + below = 1


def test_capture_and_resolve_roundtrip(mem_db):
    f = SimpleNamespace(mu_h=0.0, sigma_h=0.05, horizon_days=7, horizon="1w")
    markets = [{"question": "Will Bitcoin be above $60,000 on 2026-06-11?",
                "yes_prob": 0.70, "end_date": "2026-06-11T00:00:00+00:00"}]
    assert capture_markets(mem_db, markets, [f], spot=65000.0,
                           now_iso="2026-06-04T00:00:00+00:00") == 1
    # capture is once-only (we score the at-issue odds, not a later quote)
    assert capture_markets(mem_db, markets, [f], spot=65000.0,
                           now_iso="2026-06-04T01:00:00+00:00") == 0
    ts = datetime.datetime(2026, 6, 11, tzinfo=datetime.timezone.utc).timestamp()
    insert_prices(mem_db, [("coinbase", "1d", ts, 0, 0, 0, 66000.0, 0)])   # 66k > 60k -> yes
    resolved = resolve_markets(mem_db, "2026-06-12T00:00:00+00:00")
    assert len(resolved) == 1
    r = get_resolved_markets(mem_db)[0]
    assert r["outcome"] == 1
    assert abs(r["market_brier"] - (0.70 - 1) ** 2) < 1e-9
    assert r["model_brier"] is not None


def test_build_extras_includes_market_headtohead(mem_db):
    from btc_oracle.snapshots import build_extras
    ex = build_extras(mem_db)
    assert "market_headtohead" in ex and ex["market_headtohead"]["n"] == 0

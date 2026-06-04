# BTC Oracle — Phase C: Proper Scoring & Credibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade scoring to proper, credibility-grade metrics: **CRPS** (+ skill vs random walk), **PIT** for calibration, **Brier decomposition** (reliability/resolution/uncertainty), **rolling windows** (all / last-30 / last-90 resolved) with **N**, an **overlay-vs-baseline A/B**, and a **Polymarket "what real-money markets imply"** context feed. Everything degrades to empty/`n=0` until forecasts mature (honest, by design).

**Architecture:** Pure `crps_normal` + an enhanced `score_forecast` (computes CRPS/PIT from stored `mu_h`/`sigma_h`, populating already-existing table columns — no schema migration). `resolve` stores them; `store.get_scored_detail` returns everything per resolved forecast; `snapshots.build_scores` does the rich Python aggregation, **additively** (keeps the existing `{n,brier,brier_base,bss,mape,coverage}` keys so the current dashboard keeps working) plus new keys for the Phase-D calibration panel. A fail-soft Polymarket adapter adds a `markets` feed to `latest.json`. This is Phase C of the improvement roadmap.

**Tech Stack:** Python 3.10+, stdlib `math`/`statistics.NormalDist`, `httpx` (Polymarket, injected). No new deps.

**Verified Polymarket shape (gamma API, probed 2026-06-03):**
`GET https://gamma-api.polymarket.com/markets?closed=false&order=volume24hr&ascending=false&limit=200`
→ list of `{ "question": "Will the price of Bitcoin be above $62,000 on June 4?", "outcomes": "[\"Yes\",\"No\"]", "outcomePrices": "[\"0.7125\",\"0.2875\"]", "endDate": "...", "volume24hr": ... }` (note: `outcomes`/`outcomePrices` are **JSON-encoded strings**).

**Honesty:** CRPSS/BSS near 0 is the honest expected result; always show N. The A/B and Polymarket panels are credibility-builders — present Polymarket as *context* ("real-money markets imply"), not a claimed head-to-head.

---

## File structure
```
src/btc_oracle/scoring.py      # + crps_normal(); score_forecast computes crps/crps_rw/pit (optional mu_h,sigma_h)
src/btc_oracle/store.py        # get_unresolved_matured (+mu_h,sigma_h,baseline_*,conf_level); + get_scored_detail()
src/btc_oracle/resolve.py      # pass mu_h/sigma_h to score_forecast; persist crps/crps_rw/pit
src/btc_oracle/snapshots.py    # build_scores: rich additive aggregate (windows, decomposition, CRPSS, A/B)
src/btc_oracle/events/polymarket.py + cli.py/run_hourly.py/snapshots.py (markets in latest.json)
tests: test_scoring.py (append), test_extras.py/test_store_writes.py (edits), test_polymarket.py, test_snapshots(_feed)
```

---

### Task 1: CRPS + PIT in scoring (`scoring.py`)

**Files:**
- Modify: `src/btc_oracle/scoring.py`
- Test: `tests/test_scoring.py` (append)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_scoring.py  (add)
import math
from btc_oracle.scoring import crps_normal, score_forecast


def test_crps_normal_basic():
    # CRPS of a point forecast (sigma->0) is the absolute error
    assert abs(crps_normal(2.0, 0.0, 1e-9) - 2.0) < 1e-3
    # CRPS is non-negative and finite
    c = crps_normal(0.05, 0.0, 0.1)
    assert c > 0 and math.isfinite(c)


def test_score_forecast_adds_crps_and_pit_when_vol_given():
    s = score_forecast(p_up=0.6, central=108.0, lower=95.0, upper=120.0,
                       spot_at_issue=100.0, realized=110.0, mu_h=0.0, sigma_h=0.1)
    x = math.log(110.0 / 100.0)
    assert abs(s["crps_rw"] - abs(x)) < 1e-9        # RW = point 0-change -> |log return|
    assert s["crps"] is not None and s["crps"] > 0
    assert 0.0 <= s["pit"] <= 1.0


def test_score_forecast_crps_none_without_vol():
    s = score_forecast(p_up=0.6, central=108.0, lower=95.0, upper=120.0,
                       spot_at_issue=100.0, realized=110.0)
    assert s["crps"] is None and s["pit"] is None     # backward compatible
    assert s["brier"] == (0.6 - 1) ** 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_scoring.py -v`
Expected: FAIL — `ImportError: cannot import name 'crps_normal'`

- [ ] **Step 3: Write minimal implementation** (modify `scoring.py`)

Add the imports + helper at the top, and extend the returned dict:
```python
import math
from statistics import NormalDist

_ND = NormalDist()


def crps_normal(x: float, mu: float, sigma: float) -> float:
    """Closed-form CRPS of a Normal(mu, sigma) predictive distribution at outcome x.
    Lower is better; reduces to |x - mu| as sigma -> 0."""
    if sigma <= 0:
        return abs(x - mu)
    z = (x - mu) / sigma
    return sigma * (z * (2 * _ND.cdf(z) - 1) + 2 * _ND.pdf(z) - 1.0 / math.sqrt(math.pi))
```
Change `score_forecast`'s signature to accept optional vol, and add `crps`/`crps_rw`/`pit` to the
returned dict (keep all existing keys unchanged):
```python
def score_forecast(*, p_up, central, lower, upper, spot_at_issue, realized,
                   mu_h=None, sigma_h=None) -> dict:
    up = 1 if realized > spot_at_issue else 0
    brier = (p_up - up) ** 2
    brier_base = (0.5 - up) ** 2
    bss = (1.0 - brier / brier_base) if brier_base > 0 else None
    ae = abs(realized - central)
    ape = (ae / realized * 100.0) if realized else None
    rw_ae = abs(realized - spot_at_issue)
    mae_ratio = (ae / rw_ae) if rw_ae > 0 else None
    covered = 1 if lower <= realized <= upper else 0
    crps = crps_rw = pit = None
    if mu_h is not None and sigma_h is not None and realized > 0 and spot_at_issue > 0:
        x = math.log(realized / spot_at_issue)          # realized log-return
        crps = crps_normal(x, mu_h, sigma_h)
        crps_rw = abs(x)                                  # random walk = deterministic 0 change
        pit = _ND.cdf((x - mu_h) / sigma_h) if sigma_h > 0 else None
    return {"up_outcome": up, "brier": brier, "brier_base": brier_base, "bss": bss,
            "ae": ae, "ape": ape, "mae_ratio": mae_ratio, "covered": covered,
            "crps": crps, "crps_rw": crps_rw, "pit": pit}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_scoring.py -v`
Expected: PASS (existing + 3 new)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/scoring.py tests/test_scoring.py
git commit -m "feat(scoring): CRPS (closed-form) + PIT, optional vol inputs"
```

---

### Task 2: Store the new scores + scored-detail query (`store.py`, `resolve.py`)

**Files:**
- Modify: `src/btc_oracle/store.py`, `src/btc_oracle/resolve.py`
- Test: `tests/test_store_writes.py` (append), `tests/test_resolve.py` (append)

- [ ] **Step 1: Write the failing test** (append to `tests/test_store_writes.py`)

```python
# tests/test_store_writes.py  (add)
from btc_oracle.store import get_scored_detail


def test_get_unresolved_matured_includes_vol_and_baseline(mem_db):
    _seed_forecast(mem_db, run_at="2026-06-01T00:00:00+00:00",
                   target_at="2026-06-08T00:00:00+00:00", spot=65000.0)
    rows = get_unresolved_matured(mem_db, "2026-06-10T00:00:00+00:00")
    assert "mu_h" in rows[0].keys() and "sigma_h" in rows[0].keys()
    assert "baseline_central" in rows[0].keys() and "conf_level" in rows[0].keys()


def test_get_scored_detail_returns_joined_rows(mem_db):
    _, fid = _seed_forecast(mem_db, run_at="t", target_at="t2", spot=65000.0)
    insert_score(mem_db, {"forecast_id": fid, "horizon": "1w", "resolved_at": "t3",
                          "realized_price": 66000.0, "up_outcome": 1, "brier": 0.16,
                          "brier_base": 0.25, "bss": 0.36, "ae": 1000.0, "ape": 1.5,
                          "mae_ratio": 1.0, "covered": 1, "crps": 0.02, "crps_rw": 0.03, "pit": 0.6})
    rows = get_scored_detail(mem_db, "1w")
    assert len(rows) == 1
    r = rows[0]
    assert r["realized_price"] == 66000.0 and r["crps"] == 0.02
    assert "baseline_p_up" in r.keys() and "spot_at_issue" in r.keys() and "conf_level" in r.keys()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_store_writes.py -q`
Expected: FAIL — `get_scored_detail` missing / new columns absent.

- [ ] **Step 3: Write minimal implementation**

In `store.py`, replace `get_unresolved_matured` (add the vol + baseline + conf_level columns):
```python
def get_unresolved_matured(conn, now_iso: str):
    return conn.execute(
        "SELECT f.forecast_id, f.horizon, f.target_at, f.central, f.lower, f.upper, f.p_up, "
        "f.mu_h, f.sigma_h, f.conf_level, f.baseline_central, f.baseline_p_up, f.baseline_sigma_h, "
        "r.spot_at_issue FROM forecasts f JOIN runs r ON f.run_id = r.run_id "
        "WHERE f.resolved = 0 AND f.target_at <= ? ORDER BY f.target_at ASC",
        (now_iso,),
    ).fetchall()
```
And add `get_scored_detail`:
```python
def get_scored_detail(conn, horizon: str):
    """Everything needed to aggregate rich scores for one horizon, newest-resolved first."""
    return conn.execute(
        "SELECT s.realized_price, s.up_outcome, s.covered, s.crps, s.crps_rw, s.pit, "
        "s.brier, s.brier_base, s.ape, s.resolved_at, "
        "f.p_up, f.central, f.sigma_h, f.mu_h, f.conf_level, "
        "f.baseline_p_up, f.baseline_central, f.baseline_sigma_h, r.spot_at_issue "
        "FROM scores s JOIN forecasts f ON f.forecast_id = s.forecast_id "
        "JOIN runs r ON r.run_id = f.run_id WHERE s.horizon = ? ORDER BY s.resolved_at DESC",
        (horizon,),
    ).fetchall()
```

In `resolve.py`, pass `mu_h`/`sigma_h` into `score_forecast` (the row now has them):
```python
        s = score_forecast(p_up=row["p_up"], central=row["central"], lower=row["lower"],
                           upper=row["upper"], spot_at_issue=row["spot_at_issue"],
                           realized=realized, mu_h=row["mu_h"], sigma_h=row["sigma_h"])
```
(`insert_score` already persists `crps`/`crps_rw`/`pit` via `.get()` — they were always in the columns,
now they get real values.)

- [ ] **Step 4: Write a resolve test confirming CRPS is persisted** (append to `tests/test_resolve.py`)

```python
# tests/test_resolve.py  (add)
from btc_oracle.store import get_scored_detail


def test_resolution_persists_crps(mem_db):
    from datetime import datetime, timezone
    from btc_oracle.store import insert_run, insert_forecast, insert_prices
    from btc_oracle.baseline import forecast_from_sigma_h
    target = datetime(2026, 6, 8, tzinfo=timezone.utc)
    insert_prices(mem_db, [("coinbase", "1d", target.timestamp(), 0, 0, 0, 71000.0, 0)])
    rid = insert_run(mem_db, run_at="2026-06-01T00:00:00+00:00", spot_at_issue=65000.0,
                     spot_source="cg", model_id="m", prompt_version="v", engine_version="e", llm_applied=False)
    f = forecast_from_sigma_h(spot=65000.0, sigma_h=0.06, horizon="1w", horizon_days=7,
                              mu_daily=0.0, conf_level=0.60, vol_model="gjr-garch", vol_window=300)
    insert_forecast(mem_db, run_id=rid, target_at=target.isoformat(), forecast=f,
                    rationale="r", drift_mode="zero")
    from btc_oracle.resolve import resolve_matured
    resolve_matured(mem_db, "2026-06-10T00:00:00+00:00")
    detail = get_scored_detail(mem_db, "1w")
    assert detail[0]["crps"] is not None and detail[0]["crps"] > 0
```

- [ ] **Step 5: Run tests + full suite**

Run: `.venv/Scripts/python -m pytest tests/test_store_writes.py tests/test_resolve.py -q`
Expected: PASS.
Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (whole suite).

- [ ] **Step 6: Commit**

```bash
git add src/btc_oracle/store.py src/btc_oracle/resolve.py tests/test_store_writes.py tests/test_resolve.py
git commit -m "feat(store/resolve): persist CRPS/PIT; scored-detail query for rich aggregates"
```

---

### Task 3: Rich score aggregation (`snapshots.build_scores`)

**Files:**
- Modify: `src/btc_oracle/snapshots.py`
- Test: `tests/test_snapshots.py` (append)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_snapshots.py  (add)
from btc_oracle.snapshots import build_scores
from btc_oracle.store import insert_run, insert_forecast, insert_score
from btc_oracle.baseline import forecast_from_sigma_h


def _resolved(conn, p_up, baseline_p_up, up_outcome, crps=0.02, crps_rw=0.03, covered=1):
    rid = insert_run(conn, run_at="2026-06-01T00:00:00+00:00", spot_at_issue=65000.0, spot_source="cg",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=True)
    f = forecast_from_sigma_h(spot=65000.0, sigma_h=0.06, horizon="1w", horizon_days=7,
                              mu_daily=0.0, conf_level=0.60, vol_model="gjr-garch", vol_window=300)
    fid = insert_forecast(conn, run_id=rid, target_at="t", forecast=f, rationale="r", drift_mode="zero")
    # overwrite baseline_p_up so A/B differs from the applied p_up
    conn.execute("UPDATE forecasts SET baseline_p_up=? WHERE forecast_id=?", (baseline_p_up, fid))
    conn.commit()
    insert_score(conn, {"forecast_id": fid, "horizon": "1w", "resolved_at": "2026-06-08T00:00:00+00:00",
                        "realized_price": 66000.0, "up_outcome": up_outcome, "brier": (p_up-up_outcome)**2,
                        "brier_base": (0.5-up_outcome)**2, "bss": 0.0, "ae": 1000.0, "ape": 1.5,
                        "mae_ratio": 1.0, "covered": covered, "crps": crps, "crps_rw": crps_rw, "pit": 0.5})


def test_build_scores_empty_is_n0(mem_db):
    out = build_scores(mem_db)
    assert out["1w"] == {"n": 0} and out["1y"] == {"n": 0}


def test_build_scores_rich_aggregate(mem_db):
    _resolved(mem_db, p_up=0.7, baseline_p_up=0.5, up_outcome=1)
    _resolved(mem_db, p_up=0.6, baseline_p_up=0.5, up_outcome=1)
    sc = build_scores(mem_db)["1w"]
    assert sc["n"] == 2
    # backward-compatible keys still present
    for k in ("brier", "brier_base", "bss", "mape", "coverage"):
        assert k in sc
    # new keys
    assert "crps" in sc and "crpss" in sc and "coverage_nominal" in sc
    assert "reliability" in sc and "resolution" in sc
    assert "windows" in sc and set(sc["windows"]) == {"all", "last30", "last90"}
    assert sc["windows"]["all"]["n"] == 2
    # A/B: model p_up (0.7,0.6) beats baseline (0.5,0.5) when both went up
    assert sc["ab"]["model_brier"] < sc["ab"]["baseline_brier"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots.py -q`
Expected: FAIL — new keys missing.

- [ ] **Step 3: Write minimal implementation** (modify `snapshots.py`)

Add the import for the detail query (extend the existing `from .store import (...)`):
```python
from .store import (get_latest_run, get_forecasts_for_run, get_forecast_history, get_scores,
                    get_timeline, get_results, get_scored_detail)
```
Add helpers + replace `build_scores`:
```python
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
        "bss": (1.0 - brier / brier_base) if brier and brier_base else None,
        "crps": crps, "crps_rw": crps_rw,
        "crpss": (1.0 - crps / crps_rw) if crps and crps_rw else None,
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
    from .types import HORIZONS
    from .scoring import crps_normal  # noqa: F401  (used by _ab via closure import above)
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
            "windows": {"all": _window(rows), "last30": _window(rows[:30]), "last90": _window(rows[:90])},
            "ab": _ab(rows),
        })
        out[h] = agg
    return out
```
> NOTE: `_ab` and `build_scores` call `crps_normal` — import it at the top of `snapshots.py`:
> `from .scoring import crps_normal`. (Remove the inner `from .scoring import crps_normal` line if you
> add the top-level import; either works, just make `crps_normal` in scope for `_ab`.)

- [ ] **Step 4: Run test + full suite**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots.py -q`
Expected: PASS.
Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (whole suite — `build_scores` still returns `{n:0}` for empty horizons, and the
backward-compatible keys keep `buildScoreRows` working).

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/snapshots.py tests/test_snapshots.py
git commit -m "feat(snapshots): rich score aggregation (CRPS/CRPSS, decomposition, windows, A/B)"
```

---

### Task 4: Polymarket "markets imply" feed (`events/polymarket.py`)

**Files:**
- Create: `src/btc_oracle/events/polymarket.py`
- Modify: `src/btc_oracle/cli.py`, `src/btc_oracle/run_hourly.py`, `src/btc_oracle/snapshots.py`
- Test: `tests/test_polymarket.py`, `tests/test_run_hourly_feed.py` (edit)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_polymarket.py
from btc_oracle.events.polymarket import parse_markets, fetch_markets

RAW = [
    {"question": "Will the price of Bitcoin be above $62,000 on June 4?",
     "outcomes": "[\"Yes\", \"No\"]", "outcomePrices": "[\"0.7125\", \"0.2875\"]",
     "endDate": "2026-06-04T12:00:00Z", "volume24hr": 50000},
    {"question": "Will Ethereum hit $4k?", "outcomes": "[\"Yes\",\"No\"]",
     "outcomePrices": "[\"0.1\",\"0.9\"]", "endDate": "x", "volume24hr": 999999},
    {"question": "Will Bitcoin reach $100,000 in June?", "outcomes": "[\"Yes\",\"No\"]",
     "outcomePrices": "[\"0.02\",\"0.98\"]", "endDate": "2026-06-30T12:00:00Z", "volume24hr": 12000},
]


def test_parse_markets_keeps_btc_only_with_yes_prob():
    out = parse_markets(RAW, limit=5)
    qs = [m["question"] for m in out]
    assert all("bitcoin" in q.lower() for q in qs)        # Ethereum dropped
    assert len(out) == 2
    m = out[0]
    assert "yes_prob" in m and 0 <= m["yes_prob"] <= 1
    assert m["yes_prob"] == 0.7125                         # parsed from JSON-string outcomePrices


def test_parse_handles_garbage_rows():
    out = parse_markets([{"question": "Will Bitcoin moon?", "outcomePrices": "not-json"}], limit=5)
    assert out == []                                      # unparseable -> skipped


def test_fetch_uses_getter_and_is_fail_soft():
    def fake_get(url, params, headers):
        assert "polymarket" in url
        return RAW
    assert len(fetch_markets(fake_get)) == 2
    def boom(url, params, headers):
        raise RuntimeError("down")
    assert fetch_markets(boom) == []                      # fail-soft
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_polymarket.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/events/polymarket.py
import json

URL = "https://gamma-api.polymarket.com/markets"


def parse_markets(raw_list, limit: int = 5) -> list[dict]:
    """Keep live BTC price-threshold markets with a parseable Yes price. Returns
    [{question, yes_prob, end_date}] — context for 'what real-money markets imply'."""
    out = []
    for m in raw_list or []:
        q = (m.get("question") or "")
        if "bitcoin" not in q.lower() and "btc" not in q.lower():
            continue
        try:
            prices = json.loads(m.get("outcomePrices") or "[]")
            yes = float(prices[0])
        except Exception:
            continue
        out.append({"question": q, "yes_prob": yes, "end_date": m.get("endDate")})
        if len(out) >= limit:
            break
    return out


def fetch_markets(http_get, limit: int = 5) -> list[dict]:
    """Fetch top live BTC markets from Polymarket gamma. Fail-soft -> []."""
    try:
        raw = http_get(URL, {"closed": "false", "order": "volume24hr",
                             "ascending": "false", "limit": 200}, {})
        return parse_markets(raw, limit=limit)
    except Exception:
        return []
```

In `cli.py`: add a markets fetch to `cmd_run` and thread it through. Near the top imports add
`from .events.polymarket import fetch_markets`. In `cmd_run`, after the `news = ...` line add:
```python
    markets = fetch_markets(_httpx_get)
```
and pass `markets=markets` into the `run_once(...)` call.

In `run_hourly.py`, add `markets=None` to `run_once`'s signature and pass it to `write_snapshots`:
```python
def run_once(conn, settings, *, now_iso, spot, http_get, claude_call, out_dir,
             model_id="baseline-only", news=None, spot_source="coingecko", markets=None):
```
...and change the snapshot call to:
```python
    written = write_snapshots(conn, out_dir, signals=signals, news=news or [], regime=regime, markets=markets or [])
```

In `snapshots.py`: `write_snapshots(conn, out_dir, signals=None, news=None, regime=None, markets=None)`
and `build_latest(conn, signals=None, news=None, regime=None, markets=None)` — add
`"markets": markets or []` to BOTH return dicts in `build_latest`, and pass `markets=markets` from
`write_snapshots` into `build_latest`.

- [ ] **Step 4: Update the run_hourly feed test** (it asserts latest.json shape)

In `tests/test_run_hourly_feed.py`, the `_http_get` fake raises `AssertionError(url)` on unknown URLs.
Add a polymarket branch so the run doesn't blow up (it's fail-soft anyway, but keep the fake clean):
add near the other branches in BOTH fakes:
```python
    if "polymarket" in url:
        return []
```
(If a fake has no catch-all assert and already returns for known URLs, this is harmless. Run the test
and fix only if it fails.)

- [ ] **Step 5: Run tests + full suite + smoke**

Run: `.venv/Scripts/python -m pytest tests/test_polymarket.py tests/test_run_hourly_feed.py -q`
Expected: PASS.
Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (whole suite).
Smoke:
```bash
.venv/Scripts/python -m btc_oracle.cli run
.venv/Scripts/python -c "import json;d=json.load(open('public_html/data/latest.json'));print('markets:',[(m['question'][:40], m['yes_prob']) for m in d.get('markets',[])][:3])"
```
Expected: prints a few live Polymarket BTC markets with Yes probabilities (or `[]` if Polymarket is unreachable — fail-soft).

- [ ] **Step 6: Commit**

```bash
git add src/btc_oracle/events/polymarket.py src/btc_oracle/cli.py src/btc_oracle/run_hourly.py src/btc_oracle/snapshots.py tests/test_polymarket.py tests/test_run_hourly_feed.py
git commit -m "feat(markets): Polymarket 'what real-money markets imply' feed in latest.json"
```

---

## Self-Review

**1. Coverage:** CRPS + CRPSS (Task 1/3), PIT (Task 1, for the Phase-D calibration panel), Brier
decomposition reliability/resolution/uncertainty (Task 3), coverage vs nominal (Task 3), rolling
windows all/last30/last90 + N + Brier CI (Task 3), overlay-vs-baseline A/B from stored `baseline_*`
(Task 3), Polymarket context feed (Task 4). All additive; existing `buildScoreRows` keys preserved;
everything `n=0`-safe until forecasts mature. **No schema migration** (CRPS/PIT columns pre-existed).

**2. Placeholder scan:** No TBD/TODO. Complete code; the NOTEs (crps_normal import placement; the
run_hourly fake's polymarket branch) are exact. Backward-compatibility of `build_scores` keys is
explicit.

**3. Type consistency:** `crps_normal(x,mu,sigma)->float` used by `score_forecast` + `_ab`.
`score_forecast(..., mu_h=None, sigma_h=None)` matches the `resolve` call (now passing them) and the
old call sites (defaults keep them working). `get_unresolved_matured` row gains `mu_h/sigma_h/conf_level/
baseline_*` — read by `resolve`. `get_scored_detail` columns are exactly what `_window/_decomposition/_ab`
read. `build_scores(conn)->dict[horizon]` keeps `{n,brier,brier_base,bss,mape,coverage}` + adds keys.
`fetch_markets(http_get)->list[{question,yes_prob,end_date}]` threads through `cmd_run`→`run_once`→
`write_snapshots`→`build_latest` (all gain a `markets`/`markets=None` param).

---

## Next phase
- **Phase D** — frontend & content: calibration panel (reliability + PIT + coverage curve from the new scores), overlay-vs-baseline + CRPSS display, "markets imply" panel, regime indicator, nicer dvol label, resolved-vs-forecast history with misses, "your call vs model" (localStorage), About/Methodology page, homepage at root, OG share cards (engine-rendered), RSS + public JSON.

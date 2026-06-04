# BTC Oracle — Phase B: Methodology Upgrade (GJR-GARCH + Regime + Deribit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the symmetric EWMA volatility with **GJR-GARCH** conditional volatility (the verified out-of-sample winner for crypto), using the proper mean-reverting multi-day variance term structure; add **volatility-regime detection that widens published intervals during turbulent periods** (the most honesty-aligned upgrade); and add a **Deribit implied-volatility (DVOL)** signal. All fail-soft.

**Architecture:** Two new pure-ish modules — `garch.py` (`garch_sigma_h`, fail-soft → `None`) and `regime.py` (`detect_regime`) — plus a `forecast_from_sigma_h` baseline constructor. `compute_current_baseline` now uses GJR-GARCH per horizon (falling back to EWMA·√t), applies the regime widening, sets `vol_model`, and returns `(forecasts, regime)`. The regime is threaded into `latest.json`. The lognormal band + bounded Claude overlay are **unchanged** (the overlay still recomputes from `mu_h`/`sigma_h`), so this is a clean volatility-input upgrade. This is Phase B of the improvement roadmap.

**Tech Stack:** Python 3.10+, **`arch`** (GARCH; pulls numpy/scipy/pandas — installs fine on GitHub Actions + Windows wheels), stdlib `math`. Why GJR (`o=1`) + the analytic multi-step variance: it's asymmetric (verified winner, Emerald RAUSP 2025) and **deterministic** (no Monte-Carlo RNG → easy tests; the proper mean-reverting term structure beats √-time).

**Verified Deribit DVOL shape (probed 2026-06-03):**
`GET https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=<ms>&end_timestamp=<ms>&resolution=3600`
→ `{"result":{"data":[[ts_ms, open, high, low, close], ...]}}` (close = annualized implied vol %, e.g. 46.34).

**Honesty note:** regime-widening **operationalizes** "show more uncertainty when we're provably less reliable" — it never narrows dishonestly; it only widens. Do NOT claim a specific best fat-tailed distribution (NIG-superiority failed verification) — the band stays lognormal/Normal for now.

---

## File structure
```
src/btc_oracle/garch.py        # garch_sigma_h(returns, horizon_days) -> float | None
src/btc_oracle/regime.py       # detect_regime(returns) -> (label, percentile, widen_mult)
src/btc_oracle/baseline.py     # + forecast_from_sigma_h(...)
src/btc_oracle/cli.py          # compute_current_baseline -> (forecasts, regime); build_enriched_forecasts returns regime
src/btc_oracle/run_hourly.py   # unpack regime; pass to write_snapshots
src/btc_oracle/snapshots.py    # build_latest + write_snapshots carry `regime`
src/btc_oracle/events/deribit.py + collect.py
requirements.txt               # + arch
tests: test_garch.py, test_regime.py, test_deribit.py, (edits to test_cli.py, test_cli_preview.py, test_snapshots_feed.py)
```

---

### Task 1: GJR-GARCH volatility (`garch.py`) + dependency

**Files:**
- Modify: `requirements.txt`
- Create: `src/btc_oracle/garch.py`
- Test: `tests/test_garch.py`

- [ ] **Step 1: Add dependency + install**

Append to `requirements.txt`:
```
arch>=7.0
```
Run: `.venv/Scripts/python -m pip install -q "arch>=7.0"`
Expected: installs arch + numpy/scipy/pandas wheels cleanly.

- [ ] **Step 2: Write the failing test**

```python
# tests/test_garch.py
import numpy as np
from btc_oracle.garch import garch_sigma_h


def _returns(n=400, seed=0):
    return list(np.random.default_rng(seed).normal(0.0, 0.03, n))


def test_returns_positive_and_grows_with_horizon():
    r = _returns()
    s7 = garch_sigma_h(r, 7)
    s30 = garch_sigma_h(r, 30)
    assert s7 is not None and s30 is not None
    assert s7 > 0 and s30 > s7                 # total variance accumulates over more days
    # sanity: a ~3%/day series over 7 days has sigma roughly in a plausible band
    assert 0.02 < s7 < 0.5


def test_fail_soft_on_too_little_data():
    assert garch_sigma_h([0.01, -0.01, 0.02], 7) is None
    assert garch_sigma_h([], 7) is None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_garch.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.garch'`

- [ ] **Step 4: Write minimal implementation**

```python
# src/btc_oracle/garch.py
import numpy as np


def garch_sigma_h(returns, horizon_days: int, *, min_obs: int = 100):
    """GJR-GARCH(1,1) total H-day log-return volatility: the square root of the
    SUM of forecasted daily variances (the proper mean-reverting term structure,
    better than naive sqrt-time). Returns None on too-little-data or any fit
    failure, so the caller falls back to EWMA. Asymmetric (o=1) per the verified
    out-of-sample winner for crypto."""
    try:
        r = np.asarray(list(returns), dtype=float)
        if r.size < min_obs:
            return None
        from arch import arch_model
        # arch is numerically happier with percent returns; convert variance back after.
        am = arch_model(r * 100.0, mean="Zero", vol="GARCH", p=1, o=1, q=1, dist="normal")
        res = am.fit(disp="off", show_warning=False)
        fc = res.forecast(horizon=horizon_days, reindex=False)
        daily_var_pct2 = np.asarray(fc.variance.values[0], dtype=float)  # %^2 per day
        total_var = float(np.sum(daily_var_pct2)) / (100.0 ** 2)         # -> log-return^2
        if not np.isfinite(total_var) or total_var <= 0:
            return None
        return float(np.sqrt(total_var))
    except Exception:
        return None
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_garch.py -v`
Expected: PASS (2 passed). (First arch import may print nothing; warnings suppressed.)

- [ ] **Step 6: Commit**

```bash
git add requirements.txt src/btc_oracle/garch.py tests/test_garch.py
git commit -m "feat(garch): GJR-GARCH multi-step conditional volatility (fail-soft)"
```

---

### Task 2: Volatility-regime detection (`regime.py`)

**Files:**
- Create: `src/btc_oracle/regime.py`
- Test: `tests/test_regime.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_regime.py
import numpy as np
from btc_oracle.regime import detect_regime


def test_calm_series_is_normal():
    calm = [0.001] * 200
    label, pct, widen = detect_regime(calm)
    assert label == "normal" and widen == 1.0


def test_recent_vol_spike_is_high_and_widens():
    rng = np.random.default_rng(1)
    series = list(rng.normal(0, 0.005, 200)) + list(rng.normal(0, 0.06, 20))  # calm then turbulent
    label, pct, widen = detect_regime(series)
    assert label in ("elevated", "high")
    assert widen > 1.0 and pct > 0.6


def test_short_series_defaults_normal():
    label, pct, widen = detect_regime([0.01, -0.01])
    assert label == "normal" and widen == 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_regime.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/regime.py
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
    pct = float(np.mean(rolling <= current))
    if pct >= 0.85:
        return ("high", pct, 1.15)
    if pct >= 0.65:
        return ("elevated", pct, 1.07)
    return ("normal", pct, 1.0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_regime.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/regime.py tests/test_regime.py
git commit -m "feat(regime): volatility-regime detection that widens intervals in turbulence"
```

---

### Task 3: `forecast_from_sigma_h` baseline constructor (`baseline.py`)

**Files:**
- Modify: `src/btc_oracle/baseline.py`
- Test: `tests/test_baseline.py` (append)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_baseline.py  (add)
from btc_oracle.baseline import forecast_from_sigma_h


def test_forecast_from_sigma_h_builds_band_directly():
    f = forecast_from_sigma_h(spot=60000.0, sigma_h=0.08, horizon="1m", horizon_days=30,
                              mu_daily=0.0, conf_level=0.60, vol_model="gjr-garch", vol_window=300)
    assert f.sigma_h == 0.08
    assert f.vol_model == "gjr-garch"
    assert f.lower < f.central < f.upper
    assert abs(f.central - 60000.0) < 1e-6        # mu=0 -> central == spot
    assert 0.0 < f.p_up < 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_baseline.py::test_forecast_from_sigma_h_builds_band_directly -v`
Expected: FAIL — `ImportError: cannot import name 'forecast_from_sigma_h'`

- [ ] **Step 3: Write minimal implementation** (append to `baseline.py`)

```python
def forecast_from_sigma_h(*, spot, sigma_h, horizon, horizon_days, mu_daily=0.0,
                          conf_level=0.60, vol_model="gjr-garch", vol_window=0):
    """Build a BaselineForecast from a pre-computed HORIZON volatility `sigma_h`
    (e.g. from GJR-GARCH) rather than scaling a daily sigma by sqrt(time)."""
    if sigma_h <= 0:
        raise ValueError("sigma_h must be positive")
    mu_h = mu_daily * horizon_days
    central = spot * math.exp(mu_h)
    z = _ND.inv_cdf((1 + conf_level) / 2)
    lower = spot * math.exp(mu_h - z * sigma_h)
    upper = spot * math.exp(mu_h + z * sigma_h)
    p_up = _ND.cdf(mu_h / sigma_h)
    return BaselineForecast(
        horizon=horizon, horizon_days=horizon_days, spot=spot, central=central,
        lower=lower, upper=upper, conf_level=conf_level, p_up=p_up, mu_h=mu_h,
        sigma_h=sigma_h, vol_model=vol_model, vol_window=vol_window,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_baseline.py -v`
Expected: PASS (all baseline tests)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/baseline.py tests/test_baseline.py
git commit -m "feat(baseline): forecast_from_sigma_h constructor for GARCH horizon vol"
```

---

### Task 4: Wire GARCH + regime into the pipeline (`cli.py`) + thread regime to snapshot

**Files:**
- Modify: `src/btc_oracle/cli.py`, `src/btc_oracle/run_hourly.py`, `src/btc_oracle/snapshots.py`
- Test: edit `tests/test_cli.py`, `tests/test_cli_preview.py`, `tests/test_snapshots_feed.py`

- [ ] **Step 1: Update the affected tests first** (they assert the OLD shapes)

In `tests/test_cli.py`, the test `test_compute_current_baseline_returns_three` calls
`compute_current_baseline(...)` expecting a list. Change its first line that captures the result:
```python
    fs, regime = compute_current_baseline(mem_db, _settings(), spot=130.0)
    assert regime["label"] in ("normal", "elevated", "high")
```
(keep all the existing `fs`-based assertions below it unchanged).

In `tests/test_cli_preview.py`, the test unpacks `build_enriched_forecasts(...)`. Change BOTH call
sites from:
```python
    forecasts, rationale, applied, events = build_enriched_forecasts(...)
```
to:
```python
    forecasts, rationale, applied, events, regime = build_enriched_forecasts(...)
```
and after the first one add: `assert "label" in regime`.

Run: `.venv/Scripts/python -m pytest tests/test_cli.py tests/test_cli_preview.py -q`
Expected: FAIL (the implementation still returns the old shapes).

- [ ] **Step 2: Update `compute_current_baseline` and `build_enriched_forecasts` in `cli.py`**

Add imports near the existing imports at the top of `cli.py`:
```python
import math
from .types import HORIZONS
from .baseline import forecast_from_sigma_h
from .garch import garch_sigma_h
from .regime import detect_regime
```
Replace the existing `compute_current_baseline` with:
```python
def compute_current_baseline(conn, settings, spot, source="coinbase", interval="1d"):
    """GJR-GARCH horizon volatility (fallback EWMA*sqrt(t)), widened in turbulent
    regimes. Returns (forecasts, regime) where regime = {label, percentile}."""
    closes = get_closes(conn, source, interval)
    rets = log_returns(closes)
    sigma_ewma = ewma_volatility(rets, lam=settings.vol_lambda)
    label, pct, widen = detect_regime(rets)
    forecasts = []
    for h, days in HORIZONS.items():
        g = garch_sigma_h(rets, days)
        if g is not None:
            sigma_h, vol_model = g * widen, "gjr-garch"
        else:
            sigma_h, vol_model = sigma_ewma * math.sqrt(days) * widen, "ewma"
        forecasts.append(forecast_from_sigma_h(
            spot=spot, sigma_h=sigma_h, horizon=h, horizon_days=days,
            mu_daily=settings.mu_daily, conf_level=settings.conf_level,
            vol_model=vol_model, vol_window=len(rets)))
    return forecasts, {"label": label, "percentile": pct}
```
Update `build_enriched_forecasts` (it calls `compute_current_baseline`):
```python
def build_enriched_forecasts(conn, settings, spot, http_get, claude_call):
    """Baseline (GARCH+regime) -> live events -> bounded Claude overlay (or fallback).
    Returns (forecasts, rationale, llm_applied, events, regime)."""
    baselines, regime = compute_current_baseline(conn, settings, spot=spot)
    events = collect_events(http_get)
    call = claude_call if claude_call is not None else _noop_claude
    forecasts, rationale, applied = run_overlay(baselines, condense(events), call)
    return forecasts, rationale, applied, events, regime
```
Update `cmd_preview` (it unpacks `build_enriched_forecasts`): change its unpack line to
`forecasts, rationale, applied, events, regime = build_enriched_forecasts(...)` and add to its print
line: `print(f"regime={regime['label']} ...")` (prepend `regime={regime['label']}  ` to the existing
`spot=...` print).
Update `cmd_baseline` (it iterates `compute_current_baseline(...)`): change to
```python
    fs, _regime = compute_current_baseline(conn, settings, spot=spot)
    for f in fs:
```

- [ ] **Step 3: Thread `regime` into the snapshot** (`run_hourly.py`, `snapshots.py`)

In `run_hourly.py`, `run_once` calls `build_enriched_forecasts`. Update its unpack + the
`write_snapshots` call:
```python
    forecasts, rationale, llm_applied, events, regime = build_enriched_forecasts(
        conn, settings, spot=spot, http_get=http_get, claude_call=claude_call)
```
...and:
```python
    written = write_snapshots(conn, out_dir, signals=signals, news=news or [], regime=regime)
```

In `snapshots.py`, update `build_latest` and `write_snapshots` to carry `regime`:
- `build_latest(conn, signals=None, news=None, regime=None)` — add `"regime": regime or {"label": "normal", "percentile": 0.5}` to BOTH return dicts (the empty-run one and the normal one).
- `write_snapshots(conn, out_dir, signals=None, news=None, regime=None)` — pass `regime=regime` into the `build_latest(...)` call inside it.

- [ ] **Step 4: Run the affected tests + full suite**

Run: `.venv/Scripts/python -m pytest tests/test_cli.py tests/test_cli_preview.py tests/test_snapshots_feed.py -q`
Expected: PASS.
Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (whole suite green — run_once now unpacks 5 values internally; run_hourly tests still pass).

- [ ] **Step 5: Manual smoke test (real GARCH + regime)**

Run:
```bash
.venv/Scripts/python -m btc_oracle.cli run
.venv/Scripts/python -c "import json;d=json.load(open('public_html/data/latest.json'));print('regime:',d['regime']);print('vol_models:',[f.get('confidence_label') and None or 0 for f in d['forecasts']]);import sys; [print(' ',f['horizon'],'band',round(f['lower']),'-',round(f['upper'])) for f in d['forecasts']]"
.venv/Scripts/python -c "import json;d=json.load(open('public_html/data/latest.json'));print('forecast vol_model present:', 'regime' in d)"
```
Expected: prints `regime: {'label': 'normal'|'elevated'|'high', 'percentile': ...}` and three horizon bands; the run completes with GARCH-based volatility (or EWMA fallback if arch ever fails).

- [ ] **Step 6: Commit**

```bash
git add src/btc_oracle/cli.py src/btc_oracle/run_hourly.py src/btc_oracle/snapshots.py tests/test_cli.py tests/test_cli_preview.py tests/test_snapshots_feed.py
git commit -m "feat(engine): GJR-GARCH + regime volatility in the forecast pipeline; regime in snapshot"
```

---

### Task 5: Deribit implied-vol (DVOL) signal (`events/deribit.py`)

**Files:**
- Create: `src/btc_oracle/events/deribit.py`
- Modify: `src/btc_oracle/events/collect.py`
- Test: `tests/test_deribit.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_deribit.py
from btc_oracle.events.deribit import parse_dvol, fetch

PAYLOAD = {"result": {"data": [
    [1780513200000, 44.0, 45.0, 43.5, 44.18],
    [1780516800000, 44.18, 46.34, 44.18, 46.34],
]}}


def test_parse_dvol_latest_close_and_delta():
    e = parse_dvol(PAYLOAD)
    assert e.source == "dvol"
    assert abs(e.value - 46.34) < 1e-6          # latest close
    assert abs(e.delta - (46.34 - 44.18)) < 1e-6  # vs prior close
    assert "implied vol" in e.interpretation.lower()


def test_parse_empty_returns_none():
    assert parse_dvol({"result": {"data": []}}) is None


def test_fetch_uses_getter():
    captured = {}
    def fake_get(url, params, headers):
        captured["url"] = url
        return PAYLOAD
    evs = fetch(fake_get)
    assert len(evs) == 1 and "deribit" in captured["url"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_deribit.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/events/deribit.py
from .base import Event, iso_from_ms

URL = "https://www.deribit.com/api/v2/public/get_volatility_index_data"


def parse_dvol(payload: dict) -> Event | None:
    data = (payload.get("result") or {}).get("data") or []
    if not data:
        return None
    latest = data[-1]                 # [ts_ms, open, high, low, close]
    close = float(latest[4])
    prev = float(data[-2][4]) if len(data) > 1 else close
    delta = close - prev
    mood = "rising (more fear/uncertainty)" if delta > 0 else "falling (calmer)"
    return Event(
        source="dvol", signal="implied_vol", value=close, delta=delta,
        interpretation=f"Deribit implied vol (DVOL) {close:.1f}% annualized, {mood}",
        observed_at=iso_from_ms(latest[0]), raw={"row": latest},
    )


def fetch(http_get, hours: int = 48) -> list[Event]:
    # request a recent hourly window; the engine's http_get adds no timestamps, so
    # ask for a wide span via a large negative offset is not possible here — instead
    # rely on Deribit returning the most recent points when only currency+resolution
    # are pinned. We pass a generous window using the 'resolution' arg only.
    params = {"currency": "BTC", "resolution": 3600,
              "start_timestamp": 1, "end_timestamp": 9999999999999}
    e = parse_dvol(http_get(URL, params, {}))
    return [e] if e else []
```
> NOTE: Deribit caps the returned window; `start_timestamp=1, end_timestamp=<huge>` returns the most
> recent available points (Deribit clamps the span), which is what we want. If Deribit ever rejects the
> span, `collect_events` swallows it (fail-soft) and the DVOL tile simply won't appear.

In `collect.py`, add Deribit to the source list:
```python
from . import fear_greed, okx, gdelt, deribit
...
_SOURCES = [
    ("fng", fear_greed.fetch),
    ("okx", okx.fetch),
    ("deribit", deribit.fetch),
    ("gdelt", gdelt.fetch_tone),
]
```

- [ ] **Step 4: Run test to verify it passes + full suite**

Run: `.venv/Scripts/python -m pytest tests/test_deribit.py tests/events/test_collect.py -v`
Expected: PASS. (`test_collect.py`'s fake_get returns its canned payloads for known URLs and raises on
unknown — confirm it still passes; if the collect test's `fake_get` raises on the new `deribit` URL,
that's fine: `collect_events` is fail-soft and the test only asserts the *other* sources are present.
If the collect test asserts an EXACT source set that now must include dvol, update that assertion to
use `>=`/`issubset` — check and fix.)
Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (whole suite).

- [ ] **Step 5: Manual smoke (live DVOL)**

Run:
```bash
.venv/Scripts/python -m btc_oracle.cli run
.venv/Scripts/python -c "import json;d=json.load(open('public_html/data/latest.json'));print('signals:',[s['source'] for s in d['signals']])"
```
Expected: `signals` now includes `dvol` (alongside fng/funding/oi/gdelt, each fail-soft).

- [ ] **Step 6: Commit**

```bash
git add src/btc_oracle/events/deribit.py src/btc_oracle/events/collect.py tests/test_deribit.py tests/events/test_collect.py
git commit -m "feat(events): Deribit implied-vol (DVOL) signal"
```

---

## Self-Review

**1. Coverage (verified roadmap items):** GJR-GARCH conditional vol with mean-reverting term structure
(Task 1), regime detection + interval widening (Task 2), wired into the pipeline with EWMA fallback +
`vol_model` labeling + regime in `latest.json` (Tasks 3–4), Deribit implied-vol signal (Task 5). The
lognormal band + bounded overlay are unchanged, so the overlay still applies on top. Fat-tail
*distribution* choice is deliberately NOT changed (unverified).

**2. Placeholder scan:** No TBD/TODO. Complete code; the two NOTEs (Deribit window clamp; the
`test_collect` source-set assertion) give exact handling. Every call-site change (`cmd_preview`,
`cmd_baseline`, `run_once`, the three test files) is enumerated in Task 4.

**3. Type consistency:** `garch_sigma_h(returns, horizon_days)->float|None` is consumed by
`compute_current_baseline`, which falls back to `ewma_volatility`·√t. `forecast_from_sigma_h` returns a
`BaselineForecast` (same type as `baseline_forecast`), so `run_overlay`/`apply_overlay` are unchanged.
`detect_regime->(label,pct,widen)` feeds the sigma widening + the `{label,percentile}` dict.
`compute_current_baseline->(forecasts, regime)` and `build_enriched_forecasts->(...,regime)` are matched
at every updated call site (`cmd_preview`, `cmd_baseline`, `run_once`, tests). `build_latest`/
`write_snapshots` gain a `regime=None` kwarg (default-safe). `parse_dvol(payload)->Event|None` matches the
Event shape the dashboard already renders.

---

## Next phases
- **Phase C** — scoring/credibility: CRPS + coverage + Brier decomposition + rolling windows + N + CIs, baseline-vs-overlay A/B, Polymarket/Kalshi odds comparison.
- **Phase D** — frontend & content: calibration panel, resolved-vs-forecast history with misses, Polymarket comparison UI, "your call vs model" (localStorage), About/Methodology page, homepage at root, OG share cards (engine-rendered), RSS + public JSON.

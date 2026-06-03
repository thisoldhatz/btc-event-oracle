# BTC Oracle — Engine Core (Data Layer + Quant Baseline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the testable heart of the BTC Oracle: ingest Bitcoin price history into SQLite and compute an honest quant baseline (central price, confidence range, and P(up)) for the 1-week / 1-month / 1-year horizons.

**Architecture:** A small Python package (`btc_oracle`) with sharply separated, individually testable modules: config (env), store (SQLite schema + helpers), prices (ccxt/CoinGecko ingest with injected clients), returns (log returns + EWMA volatility), baseline (the §6a forecast math), and a thin CLI. No network or LLM in the math modules; network code takes injected clients so tests never hit the wire. This is Plan 1 of 4 (see spec §13).

**Tech Stack:** Python 3.10+, `ccxt` (exchange OHLCV/spot), `httpx` (CoinGecko), `python-dotenv` (secrets), `pytest` (tests). Pure-stdlib math (`math`, `statistics.NormalDist`) — no numpy/scipy in the MVP, keeping installs trivial on shared hosting. Student-t / GARCH are Phase 2 (separate plan).

**Spec:** `docs/superpowers/specs/2026-06-03-btc-event-oracle-design.md` (esp. §6a baseline formulas, §8 schema, §5 sources, §14 frozen defaults).

---

## File structure

```
btc-oracle/
  pyproject.toml                 # pytest config + project metadata
  requirements.txt               # runtime + dev deps
  .env.example                   # documents required env vars (no real secrets)
  src/btc_oracle/
    __init__.py
    config.py                    # Settings dataclass + get_settings() from env
    types.py                     # HORIZONS map + BaselineForecast dataclass
    baseline.py                  # baseline_forecast() + build_baseline_forecasts()
    returns.py                   # log_returns() + ewma_volatility()
    store.py                     # SQLite schema (all spec §8 tables) + connect/init/insert/query
    prices.py                    # fetch_ohlcv/backfill (ccxt, injected) + fetch_spot (CoinGecko, injected)
    cli.py                       # compute_current_baseline() + argparse entrypoints
  tests/
    conftest.py                  # tmp-db fixture, fakes
    test_config.py
    test_types.py
    test_baseline.py
    test_returns.py
    test_store.py
    test_prices.py
    test_cli.py
```

Module responsibilities are one-each; `baseline`/`returns` are pure math (no I/O), `prices`/`store` own all I/O, `cli` wires them.

---

### Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `src/btc_oracle/__init__.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: Create `requirements.txt`**

```
ccxt==4.4.30
httpx==0.27.2
python-dotenv==1.0.1
pytest==8.3.3
```

- [ ] **Step 2: Create `pyproject.toml`** (makes `src/` importable in tests, no install needed)

```toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "btc-oracle"
version = "0.1.0"
description = "Honest hourly BTC forecasting engine"
requires-python = ">=3.10"

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
addopts = "-q"
```

- [ ] **Step 3: Create `.env.example`** (documents secrets; never holds real values)

```
# Copy to .env (which is gitignored) and fill in. NEVER commit .env.
DB_PATH=./data/oracle.db
CONF_LEVEL=0.60
VOL_LAMBDA=0.94
MU_DAILY=0.0
# Secrets (used by later plans):
ANTHROPIC_API_KEY=
COINGECKO_DEMO_KEY=
COINDESK_API_KEY=
```

- [ ] **Step 4: Create empty package + conftest**

`src/btc_oracle/__init__.py`:
```python
"""BTC Oracle — honest hourly BTC forecasting engine."""
__version__ = "0.1.0"
```

`tests/conftest.py`:
```python
import sqlite3
import pytest


@pytest.fixture
def mem_db():
    """An in-memory SQLite connection with the schema applied."""
    from btc_oracle.store import init_schema
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    init_schema(conn)
    yield conn
    conn.close()
```

- [ ] **Step 5: Create venv, install, verify pytest collects**

Run:
```bash
cd btc-oracle
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m pytest
```
Expected: pytest runs and reports "no tests ran" (exit code 5) — collection works, environment is sane. (The `mem_db` fixture imports `store` which doesn't exist yet; that's fine — it's lazy and only triggers when a test uses it.)

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml requirements.txt .env.example src/btc_oracle/__init__.py tests/conftest.py
git commit -m "chore: scaffold btc_oracle package and pytest setup"
```

---

### Task 2: Config (`config.py`)

**Files:**
- Create: `src/btc_oracle/config.py`
- Test: `tests/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_config.py
from btc_oracle.config import get_settings


def test_defaults_when_env_absent(monkeypatch):
    for k in ("DB_PATH", "CONF_LEVEL", "VOL_LAMBDA", "MU_DAILY", "ANTHROPIC_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    s = get_settings()
    assert s.db_path == "./data/oracle.db"
    assert s.conf_level == 0.60
    assert s.vol_lambda == 0.94
    assert s.mu_daily == 0.0
    assert s.anthropic_api_key is None


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("DB_PATH", "/tmp/x.db")
    monkeypatch.setenv("CONF_LEVEL", "0.8")
    monkeypatch.setenv("VOL_LAMBDA", "0.97")
    s = get_settings()
    assert s.db_path == "/tmp/x.db"
    assert s.conf_level == 0.8
    assert s.vol_lambda == 0.97
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.config'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/config.py
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()  # loads .env if present; no-op otherwise


@dataclass(frozen=True)
class Settings:
    db_path: str
    conf_level: float
    vol_lambda: float
    mu_daily: float
    anthropic_api_key: str | None
    coingecko_demo_key: str | None


def get_settings() -> Settings:
    return Settings(
        db_path=os.getenv("DB_PATH", "./data/oracle.db"),
        conf_level=float(os.getenv("CONF_LEVEL", "0.60")),
        vol_lambda=float(os.getenv("VOL_LAMBDA", "0.94")),
        mu_daily=float(os.getenv("MU_DAILY", "0.0")),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        coingecko_demo_key=os.getenv("COINGECKO_DEMO_KEY") or None,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_config.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/config.py tests/test_config.py
git commit -m "feat: settings loaded from env with frozen defaults"
```

---

### Task 3: Types (`types.py`)

**Files:**
- Create: `src/btc_oracle/types.py`
- Test: `tests/test_types.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_types.py
from btc_oracle.types import HORIZONS, BaselineForecast


def test_horizons_are_the_three_spec_horizons():
    assert HORIZONS == {"1w": 7, "1m": 30, "1y": 365}


def test_baseline_forecast_is_constructible():
    f = BaselineForecast(
        horizon="1w", horizon_days=7, spot=100.0, central=100.0,
        lower=90.0, upper=111.0, conf_level=0.6, p_up=0.5,
        mu_h=0.0, sigma_h=0.1, vol_model="ewma", vol_window=300,
    )
    assert f.horizon == "1w"
    assert f.lower < f.central < f.upper
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_types.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.types'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/types.py
from dataclasses import dataclass

# Horizon label -> number of days. Frozen per spec §14.
HORIZONS: dict[str, int] = {"1w": 7, "1m": 30, "1y": 365}


@dataclass(frozen=True)
class BaselineForecast:
    horizon: str
    horizon_days: int
    spot: float          # P0 at issue
    central: float       # median price P0*exp(mu_h)
    lower: float
    upper: float
    conf_level: float    # e.g. 0.60
    p_up: float          # directional probability
    mu_h: float          # horizon log-drift
    sigma_h: float       # horizon log-vol
    vol_model: str       # "ewma"
    vol_window: int      # number of returns used
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_types.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/types.py tests/test_types.py
git commit -m "feat: HORIZONS map and BaselineForecast type"
```

---

### Task 4: Baseline math (`baseline.py` — single horizon)

**Files:**
- Create: `src/btc_oracle/baseline.py`
- Test: `tests/test_baseline.py`

- [ ] **Step 1: Write the failing test** (hand-computed expectations)

```python
# tests/test_baseline.py
import math
from statistics import NormalDist
from btc_oracle.baseline import baseline_forecast


def test_zero_drift_centers_on_spot_and_p_up_half():
    f = baseline_forecast(spot=100.0, sigma_daily=0.02, horizon="1w",
                          horizon_days=7, mu_daily=0.0, conf_level=0.60)
    # central = 100*exp(0) = 100
    assert f.central == 100.0
    # mu=0 -> P(up)=Phi(0)=0.5
    assert abs(f.p_up - 0.5) < 1e-12
    assert f.lower < 100.0 < f.upper


def test_sigma_h_scales_with_sqrt_time():
    f = baseline_forecast(spot=100.0, sigma_daily=0.02, horizon="1m",
                          horizon_days=30, mu_daily=0.0, conf_level=0.60)
    assert abs(f.sigma_h - 0.02 * math.sqrt(30)) < 1e-12


def test_band_matches_lognormal_quantiles():
    spot, sig, days, c = 50000.0, 0.03, 7, 0.60
    f = baseline_forecast(spot=spot, sigma_daily=sig, horizon="1w",
                          horizon_days=days, mu_daily=0.0, conf_level=c)
    z = NormalDist().inv_cdf((1 + c) / 2)
    sigma_h = sig * math.sqrt(days)
    assert abs(f.upper - spot * math.exp(z * sigma_h)) < 1e-6
    assert abs(f.lower - spot * math.exp(-z * sigma_h)) < 1e-6


def test_positive_drift_pushes_p_up_above_half():
    f = baseline_forecast(spot=100.0, sigma_daily=0.02, horizon="1y",
                          horizon_days=365, mu_daily=0.0005, conf_level=0.60)
    assert f.p_up > 0.5
    assert f.central > 100.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_baseline.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.baseline'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/baseline.py
import math
from statistics import NormalDist
from .types import BaselineForecast

_ND = NormalDist()


def baseline_forecast(
    *, spot: float, sigma_daily: float, horizon: str, horizon_days: int,
    mu_daily: float = 0.0, conf_level: float = 0.60,
    vol_model: str = "ewma", vol_window: int = 0,
) -> BaselineForecast:
    """Lognormal random-walk baseline (spec §6a). MVP uses Normal quantiles."""
    if sigma_daily <= 0:
        raise ValueError("sigma_daily must be positive")
    mu_h = mu_daily * horizon_days
    sigma_h = sigma_daily * math.sqrt(horizon_days)
    central = spot * math.exp(mu_h)
    z = _ND.inv_cdf((1 + conf_level) / 2)
    lower = spot * math.exp(mu_h - z * sigma_h)
    upper = spot * math.exp(mu_h + z * sigma_h)
    p_up = _ND.cdf(mu_h / sigma_h)
    return BaselineForecast(
        horizon=horizon, horizon_days=horizon_days, spot=spot, central=central,
        lower=lower, upper=upper, conf_level=conf_level, p_up=p_up,
        mu_h=mu_h, sigma_h=sigma_h, vol_model=vol_model, vol_window=vol_window,
    )
```

Note: the test in Step 1 calls `baseline_forecast(spot=..., sigma_daily=...)` positionally for `horizon`/`horizon_days`? No — update the tests to keyword form. The signature is keyword-only (`*`); ensure all test calls use keywords (they do above except `horizon`/`horizon_days` which are passed as keywords). Confirm tests use keyword args throughout.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_baseline.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/baseline.py tests/test_baseline.py
git commit -m "feat: lognormal random-walk baseline (range + P(up))"
```

---

### Task 5: Baseline over all horizons (`build_baseline_forecasts`)

**Files:**
- Modify: `src/btc_oracle/baseline.py` (append function)
- Test: `tests/test_baseline.py` (append test)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_baseline.py  (add)
from btc_oracle.baseline import build_baseline_forecasts
from btc_oracle.types import HORIZONS


def test_build_returns_one_forecast_per_horizon_widening():
    fs = build_baseline_forecasts(spot=60000.0, sigma_daily=0.03)
    assert [f.horizon for f in fs] == list(HORIZONS.keys())
    widths = [(f.upper - f.lower) for f in fs]
    # longer horizon -> wider band (sqrt-time)
    assert widths[0] < widths[1] < widths[2]
    for f in fs:
        assert f.lower < f.central < f.upper
        assert 0.0 < f.p_up < 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_baseline.py::test_build_returns_one_forecast_per_horizon_widening -v`
Expected: FAIL — `ImportError: cannot import name 'build_baseline_forecasts'`

- [ ] **Step 3: Write minimal implementation** (append to `baseline.py`)

```python
def build_baseline_forecasts(
    *, spot: float, sigma_daily: float, mu_daily: float = 0.0,
    conf_level: float = 0.60, vol_model: str = "ewma", vol_window: int = 0,
) -> list[BaselineForecast]:
    """One BaselineForecast per horizon in HORIZONS."""
    from .types import HORIZONS
    return [
        baseline_forecast(
            spot=spot, sigma_daily=sigma_daily, horizon=h, horizon_days=days,
            mu_daily=mu_daily, conf_level=conf_level,
            vol_model=vol_model, vol_window=vol_window,
        )
        for h, days in HORIZONS.items()
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_baseline.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/baseline.py tests/test_baseline.py
git commit -m "feat: build baseline forecasts for all three horizons"
```

---

### Task 6: Returns + EWMA volatility (`returns.py`)

**Files:**
- Create: `src/btc_oracle/returns.py`
- Test: `tests/test_returns.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_returns.py
import math
import pytest
from btc_oracle.returns import log_returns, ewma_volatility


def test_log_returns_basic():
    r = log_returns([100.0, 110.0, 99.0])
    assert len(r) == 2
    assert abs(r[0] - math.log(110/100)) < 1e-12
    assert abs(r[1] - math.log(99/110)) < 1e-12


def test_log_returns_needs_two_prices():
    with pytest.raises(ValueError):
        log_returns([100.0])


def test_ewma_recovers_constant_volatility():
    # constant |return| series -> EWMA vol converges to that magnitude
    rets = [0.02, -0.02] * 200
    vol = ewma_volatility(rets, lam=0.94)
    assert abs(vol - 0.02) < 1e-3


def test_ewma_reacts_to_recent_spike():
    calm = [0.001] * 100
    spike = calm + [0.10]
    assert ewma_volatility(spike, lam=0.94) > ewma_volatility(calm, lam=0.94)


def test_ewma_needs_two_returns():
    with pytest.raises(ValueError):
        ewma_volatility([0.01], lam=0.94)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_returns.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.returns'`

- [ ] **Step 3: Write minimal implementation**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_returns.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/returns.py tests/test_returns.py
git commit -m "feat: log returns and EWMA daily volatility"
```

---

### Task 7: SQLite store (`store.py`)

**Files:**
- Create: `src/btc_oracle/store.py`
- Test: `tests/test_store.py`

- [ ] **Step 1: Write the failing test** (uses the `mem_db` fixture from conftest)

```python
# tests/test_store.py
from btc_oracle.store import insert_prices, get_closes, table_names


def test_schema_creates_all_spec_tables(mem_db):
    names = table_names(mem_db)
    for t in ("runs", "forecasts", "events", "forecast_events", "scores", "price_history"):
        assert t in names


def test_insert_and_read_prices_ordered(mem_db):
    rows = [
        ("coinbase", "1d", 3.0, 0, 0, 0, 102.0, 0),
        ("coinbase", "1d", 1.0, 0, 0, 0, 100.0, 0),
        ("coinbase", "1d", 2.0, 0, 0, 0, 101.0, 0),
    ]
    n = insert_prices(mem_db, rows)
    assert n == 3
    closes = get_closes(mem_db, "coinbase", "1d")
    assert closes == [100.0, 101.0, 102.0]  # sorted by ts ascending


def test_insert_is_idempotent_on_primary_key(mem_db):
    row = [("coinbase", "1d", 1.0, 0, 0, 0, 100.0, 0)]
    assert insert_prices(mem_db, row) == 1
    assert insert_prices(mem_db, row) == 0  # INSERT OR IGNORE dedupes
    assert get_closes(mem_db, "coinbase", "1d") == [100.0]


def test_get_closes_respects_limit(mem_db):
    rows = [("coinbase", "1d", float(i), 0, 0, 0, float(i), 0) for i in range(10)]
    insert_prices(mem_db, rows)
    assert get_closes(mem_db, "coinbase", "1d", limit=3) == [7.0, 8.0, 9.0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_store.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.store'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/store.py
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  run_at TEXT NOT NULL,
  spot_at_issue REAL NOT NULL,
  spot_source TEXT,
  engine_version TEXT, prompt_version TEXT, model_id TEXT,
  llm_applied INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS forecasts (
  forecast_id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES runs(run_id),
  horizon TEXT NOT NULL,
  target_at TEXT NOT NULL,
  central REAL NOT NULL,
  lower REAL, upper REAL, conf_level REAL,
  q05 REAL, q25 REAL, q50 REAL, q75 REAL, q95 REAL,
  mu_h REAL, sigma_h REAL, nu REAL,
  p_up REAL NOT NULL,
  confidence_label TEXT, band_width_pct REAL,
  baseline_central REAL, baseline_p_up REAL, baseline_sigma_h REAL,
  vol_model TEXT, vol_window INTEGER, drift_mode TEXT,
  drift_adj_bps REAL, vol_mult REAL, skew_adj REAL,
  rationale TEXT,
  resolved INTEGER DEFAULT 0,
  UNIQUE (run_id, horizon)
);
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  observed_at TEXT NOT NULL,
  source TEXT, signal TEXT, value REAL, delta REAL,
  interpretation TEXT, headline TEXT, url TEXT, sentiment TEXT,
  raw TEXT
);
CREATE TABLE IF NOT EXISTS forecast_events (
  forecast_id TEXT REFERENCES forecasts(forecast_id),
  event_id TEXT REFERENCES events(event_id),
  PRIMARY KEY (forecast_id, event_id)
);
CREATE TABLE IF NOT EXISTS scores (
  forecast_id TEXT PRIMARY KEY REFERENCES forecasts(forecast_id),
  horizon TEXT, resolved_at TEXT,
  realized_price REAL, up_outcome INTEGER,
  brier REAL, brier_base REAL, bss REAL,
  crps REAL, crps_rw REAL,
  ae REAL, ape REAL, mae_ratio REAL, theil_u2 REAL,
  pit REAL, covered INTEGER
);
CREATE TABLE IF NOT EXISTS price_history (
  ts REAL, source TEXT, interval TEXT,
  open REAL, high REAL, low REAL, close REAL, volume REAL,
  PRIMARY KEY (source, interval, ts)
);
"""


def connect(db_path: str) -> sqlite3.Connection:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    return {r["name"] for r in rows}


def insert_prices(conn: sqlite3.Connection, rows) -> int:
    """rows: iterable of (source, interval, ts, open, high, low, close, volume).
    Returns the number of newly inserted rows (duplicates ignored)."""
    cur = conn.executemany(
        "INSERT OR IGNORE INTO price_history "
        "(source, interval, ts, open, high, low, close, volume) "
        "VALUES (?,?,?,?,?,?,?,?)",
        list(rows),
    )
    conn.commit()
    return cur.rowcount


def get_closes(conn, source: str, interval: str, limit: int | None = None) -> list[float]:
    rows = conn.execute(
        "SELECT close FROM price_history WHERE source=? AND interval=? ORDER BY ts ASC",
        (source, interval),
    ).fetchall()
    closes = [r["close"] for r in rows]
    return closes[-limit:] if limit else closes
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_store.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/store.py tests/test_store.py
git commit -m "feat: SQLite schema (spec §8) and price_history helpers"
```

---

### Task 8: Price ingest (`prices.py`)

**Files:**
- Create: `src/btc_oracle/prices.py`
- Test: `tests/test_prices.py`

- [ ] **Step 1: Write the failing test** (fakes — no network)

```python
# tests/test_prices.py
from btc_oracle.prices import ohlcv_to_rows, backfill, fetch_spot


class FakeExchange:
    """Returns one page of candles then empties (terminates pagination)."""
    def __init__(self, pages):
        self.pages = list(pages)
        self.calls = []

    def fetch_ohlcv(self, symbol, timeframe, since, limit):
        self.calls.append((symbol, timeframe, since, limit))
        return self.pages.pop(0) if self.pages else []


def test_ohlcv_to_rows_converts_ms_to_seconds():
    candles = [[1000, 1, 2, 0.5, 1.5, 9]]  # ms timestamp
    rows = ohlcv_to_rows(candles, "coinbase", "1d")
    assert rows == [("coinbase", "1d", 1.0, 1, 2, 0.5, 1.5, 9)]


def test_backfill_inserts_and_stops(mem_db):
    page = [[(i + 1) * 86_400_000, 0, 0, 0, 100.0 + i, 0] for i in range(5)]
    ex = FakeExchange([page])  # one page, then empty
    n = backfill(mem_db, ex, source="coinbase", timeframe="1d", page=300)
    assert n == 5
    from btc_oracle.store import get_closes
    assert get_closes(mem_db, "coinbase", "1d") == [100.0, 101.0, 102.0, 103.0, 104.0]


def test_fetch_spot_reads_coingecko_shape():
    def fake_get(url, params, headers):
        assert params["ids"] == "bitcoin"
        return {"bitcoin": {"usd": 64250.5}}
    assert fetch_spot(fake_get) == 64250.5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_prices.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.prices'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/prices.py
from .store import insert_prices


def fetch_ohlcv(exchange, symbol="BTC/USD", timeframe="1d", since=None, limit=300):
    """Thin wrapper over a ccxt exchange (injected for tests)."""
    return exchange.fetch_ohlcv(symbol, timeframe, since, limit)


def ohlcv_to_rows(candles, source, interval):
    """ccxt candle = [ms_ts, open, high, low, close, volume] -> store row
    (source, interval, ts_seconds, open, high, low, close, volume)."""
    return [
        (source, interval, c[0] / 1000.0, c[1], c[2], c[3], c[4], c[5])
        for c in candles
    ]


def backfill(conn, exchange, *, source, symbol="BTC/USD", timeframe="1d",
             since_ms=None, page=300, max_pages=20):
    """Paginate OHLCV forward and persist. Stops on empty page, a short page,
    or a non-advancing cursor. Returns count of newly inserted rows."""
    total = 0
    cursor = since_ms
    last_seen = None
    for _ in range(max_pages):
        candles = fetch_ohlcv(exchange, symbol, timeframe, since=cursor, limit=page)
        if not candles:
            break
        total += insert_prices(conn, ohlcv_to_rows(candles, source, timeframe))
        newest = candles[-1][0]
        if newest == last_seen or len(candles) < page:
            break
        last_seen = newest
        cursor = newest + 1
    return total


def fetch_spot(http_get, demo_key=None):
    """http_get: callable(url, params, headers) -> dict. Injected for tests;
    in production pass a small httpx-backed getter."""
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {"ids": "bitcoin", "vs_currencies": "usd"}
    headers = {"x-cg-demo-api-key": demo_key} if demo_key else {}
    data = http_get(url, params, headers)
    return float(data["bitcoin"]["usd"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_prices.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/prices.py tests/test_prices.py
git commit -m "feat: ccxt OHLCV backfill (paginated) and CoinGecko spot fetch"
```

---

### Task 9: CLI wiring (`cli.py`)

**Files:**
- Create: `src/btc_oracle/cli.py`
- Test: `tests/test_cli.py`

- [ ] **Step 1: Write the failing test** (tests the pure core; real network is exercised manually in Step 6)

```python
# tests/test_cli.py
from btc_oracle.cli import compute_current_baseline
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings():
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94,
                    mu_daily=0.0, anthropic_api_key=None, coingecko_demo_key=None)


def test_compute_current_baseline_returns_three(mem_db):
    # seed 60 days of gently rising closes
    rows = [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i * 0.5, 0) for i in range(60)]
    insert_prices(mem_db, rows)
    fs = compute_current_baseline(mem_db, _settings(), spot=130.0)
    assert [f.horizon for f in fs] == ["1w", "1m", "1y"]
    for f in fs:
        assert f.spot == 130.0
        assert f.lower < f.central < f.upper
        assert 0.0 < f.p_up < 1.0
        assert f.vol_model == "ewma"
        assert f.vol_window == 59  # 60 closes -> 59 returns
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_cli.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.cli'`

- [ ] **Step 3: Write minimal implementation**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_cli.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Run the FULL suite**

Run: `.venv/Scripts/python -m pytest`
Expected: PASS (all tasks' tests green)

- [ ] **Step 6: Manual smoke test against real APIs (no secrets needed for these)**

Run:
```bash
.venv/Scripts/python -m btc_oracle.cli backfill
.venv/Scripts/python -m btc_oracle.cli baseline
```
Expected: `backfill` reports a few hundred inserted candles; `baseline` prints three lines like
`  1w: central=64,250 [60,100 – 68,800] P(up)=50%` with widening bands and P(up) near 50%.
(If Coinbase rate-limits, re-run; CoinGecko spot works keyless but a free Demo key in `.env` raises limits.)

- [ ] **Step 7: Commit**

```bash
git add src/btc_oracle/cli.py tests/test_cli.py
git commit -m "feat: CLI backfill + baseline commands wired end-to-end"
```

---

## Self-Review

**1. Spec coverage (this plan's slice — spec §5 price sources, §6a baseline, §8 schema, §14 defaults):**
- §6a central/range/P(up) formulas → Task 4 ✓ ; sqrt-time + lognormal band asserted ✓
- §6a EWMA(λ=0.94) volatility → Task 6 ✓ ; λ from settings (§14 frozen default) → Task 2/9 ✓
- §6a μ_daily=0 default → Task 2 (`MU_DAILY=0.0`) ✓
- §8 full schema (all 6 tables) created up front → Task 7 ✓ (events/scores/forecasts columns present for later plans; only price_history helpers implemented now, by YAGNI)
- §5 Coinbase primary OHLCV + CoinGecko spot → Task 8/9 ✓ ; Kraken fallback is a one-line `ccxt.kraken()` swap, deferred to Plan 2's resilient ingest (noted, not silently dropped)
- §14 secrets only via gitignored `.env` → Task 1 `.env.example` + Task 2 dotenv ✓
- Out of this plan (correctly): events, Claude overlay, orchestration, scoring, dashboard, deploy → Plans 2–4.

**2. Placeholder scan:** No TBD/TODO; every code/test step shows complete code; every run step states the exact command + expected result. ✓

**3. Type consistency:** `BaselineForecast` fields (Task 3) are constructed identically in `baseline_forecast` (Task 4) and consumed in Tasks 5/9. `insert_prices` row tuple order `(source, interval, ts, open, high, low, close, volume)` is identical in `store` (Task 7), `prices.ohlcv_to_rows` (Task 8), and all tests. `get_closes`/`ewma_volatility`/`build_baseline_forecasts` signatures match their call sites in `cli.compute_current_baseline` (Task 9). `baseline_forecast` is keyword-only and all callers use keywords. ✓

---

## Next plans (not part of this one)
- **Plan 2:** event adapters (GDELT, Fear&Greed, Bybit funding, CoinDesk) → condenser → bounded Claude overlay (clamps + fallback) → `run_hourly` orchestrator → resolution + Brier/MAPE/coverage → JSON snapshot emitter.
- **Plan 3:** Next.js static-export command dashboard (Recharts) reading `/data/*.json`.
- **Plan 4:** cPanel deploy — Python app + real hourly cron + secrets + go-live, then rotate the shared cPanel password.

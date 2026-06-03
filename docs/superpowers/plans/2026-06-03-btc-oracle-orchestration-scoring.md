# BTC Oracle — Persistence, Hourly Orchestration, Resolution & Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the in-memory forecasting intelligence (Plans 1–2) into a durable hourly engine: persist each run's forecasts + events to SQLite, score forecasts against a random-walk benchmark once they mature, and emit the static JSON snapshots the dashboard will consume — all driven by one `btc-oracle run` command the cron job calls.

**Architecture:** New write/query helpers on the existing `store` module; a pure `scoring` module (proper-scoring math, TDD'd in isolation); a `resolve` module that matches matured forecasts to realized prices and writes scores; a `snapshots` module that renders the DB into `latest/history/scores` JSON; and a `run_hourly` orchestrator wired into a new `cli run` subcommand. Time (`now`) and all network/LLM are injected so every module is tested offline. This is Plan 3 of 5.

**Tech Stack:** Python 3.10+, stdlib `sqlite3`/`uuid`/`json`/`datetime`. No new dependencies.

**Verified interfaces from Plans 1–2 (do not change):**
- `store`: `connect(db_path)`, `init_schema(conn)`, `insert_prices`, `get_closes`. Tables: `runs, forecasts, events, forecast_events, scores, price_history` (columns per spec §8 — already created).
- `overlay.EnrichedForecast` fields: `horizon, horizon_days, spot, central, lower, upper, conf_level, p_up, mu_h, sigma_h, confidence_label, band_width_pct, vol_model, vol_window, baseline_central, baseline_p_up, baseline_sigma_h, drift_adj_bps, vol_mult, skew_adj, llm_applied`.
- `events.base.Event` fields: `source, signal, value, delta, interpretation, observed_at, headline, url, sentiment, raw`.
- `cli.build_enriched_forecasts(conn, settings, spot, http_get, claude_call) -> (forecasts, rationale, llm_applied, events)`; `cli._httpx_get`; `llm.make_claude_call(api_key)`.
- `config.Settings` fields: `db_path, conf_level, vol_lambda, mu_daily, anthropic_api_key, coingecko_demo_key`.
- `types.HORIZONS = {"1w":7,"1m":30,"1y":365}`.

**Spec refs:** §7 (scoring vs random walk: Brier, MAPE, coverage), §8 (schema), §4 (snapshot/data-flow).

---

## File structure

```
src/btc_oracle/
  store.py          # + uuid/json import; insert_run/insert_event/link_forecast_event/insert_forecast
                    #   + get_unresolved_matured/get_close_on_or_after/mark_resolved/insert_score
                    #   + get_latest_run/get_forecasts_for_run/get_forecast_history/get_scores
  scoring.py        # score_forecast() — pure proper-scoring math
  resolve.py        # resolve_matured(conn, now_iso) — match matured forecasts to realized price, write scores
  snapshots.py      # build_latest/build_history/build_scores + write_snapshots(conn, out_dir)
  run_hourly.py     # run_once(conn, settings, *, now_iso, spot, http_get, claude_call, out_dir, model_id)
  config.py         # + snapshot_dir setting
  cli.py            # + cmd_run + "run" subparser
tests/
  test_store_writes.py
  test_scoring.py
  test_resolve.py
  test_snapshots.py
  test_run_hourly.py
  test_cli_run.py
  test_config.py    # (extend) snapshot_dir default/override
```

---

### Task 1: `snapshot_dir` setting (`config.py`)

**Files:**
- Modify: `src/btc_oracle/config.py`
- Modify: `.env.example`
- Test: `tests/test_config.py` (append)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_config.py  (add)
def test_snapshot_dir_default_and_override(monkeypatch):
    from btc_oracle.config import get_settings
    monkeypatch.delenv("SNAPSHOT_DIR", raising=False)
    assert get_settings().snapshot_dir == "./public_html/data"
    monkeypatch.setenv("SNAPSHOT_DIR", "/srv/data")
    assert get_settings().snapshot_dir == "/srv/data"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_config.py::test_snapshot_dir_default_and_override -v`
Expected: FAIL — `AttributeError: 'Settings' object has no attribute 'snapshot_dir'`

- [ ] **Step 3: Write minimal implementation**

In `config.py`, add a field to the `Settings` dataclass (append, WITH a default so existing constructions keep working):
```python
    snapshot_dir: str = "./public_html/data"
```
And in `get_settings()` add (before the closing `)`):
```python
        snapshot_dir=os.getenv("SNAPSHOT_DIR", "./public_html/data"),
```

In `.env.example`, add after `MU_DAILY=0.0`:
```
SNAPSHOT_DIR=./public_html/data
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_config.py -v`
Expected: PASS (all config tests)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/config.py .env.example tests/test_config.py
git commit -m "feat(config): snapshot_dir setting for static JSON output"
```

---

### Task 2: Store write helpers — runs, events, links (`store.py`)

**Files:**
- Modify: `src/btc_oracle/store.py`
- Test: `tests/test_store_writes.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_store_writes.py
from btc_oracle.store import insert_run, insert_event, link_forecast_event
from btc_oracle.events.base import Event


def test_insert_run_returns_id_and_persists(mem_db):
    rid = insert_run(mem_db, run_at="2026-06-03T10:00:00+00:00", spot_at_issue=65000.0,
                     spot_source="coingecko", model_id="m1", prompt_version="v1",
                     engine_version="0.1.0", llm_applied=True)
    assert isinstance(rid, str) and len(rid) >= 16
    row = mem_db.execute("SELECT * FROM runs WHERE run_id=?", (rid,)).fetchone()
    assert row["spot_at_issue"] == 65000.0
    assert row["llm_applied"] == 1


def test_insert_event_stores_raw_as_json(mem_db):
    e = Event(source="fng", signal="fear_greed", value=11.0, delta=-12.0,
              interpretation="Extreme Fear", observed_at="2026-06-03T00:00:00+00:00",
              sentiment="Extreme Fear", raw={"value": "11"})
    eid = insert_event(mem_db, e)
    row = mem_db.execute("SELECT * FROM events WHERE event_id=?", (eid,)).fetchone()
    assert row["source"] == "fng" and row["value"] == 11.0
    assert '"value": "11"' in row["raw"]


def test_link_forecast_event_is_idempotent(mem_db):
    # forecast row must exist for FK; insert a minimal run+forecast first
    rid = insert_run(mem_db, run_at="t", spot_at_issue=1.0, spot_source="x",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=False)
    mem_db.execute("INSERT INTO forecasts (forecast_id, run_id, horizon, target_at, central, p_up) "
                   "VALUES ('f1', ?, '1w', 't2', 1.0, 0.5)", (rid,))
    e = Event(source="fng", signal="s", value=1.0, delta=None, interpretation="i",
              observed_at="t")
    eid = insert_event(mem_db, e)
    link_forecast_event(mem_db, "f1", eid)
    link_forecast_event(mem_db, "f1", eid)  # duplicate -> ignored
    n = mem_db.execute("SELECT COUNT(*) c FROM forecast_events").fetchone()["c"]
    assert n == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_store_writes.py -v`
Expected: FAIL — `ImportError: cannot import name 'insert_run'`

- [ ] **Step 3: Write minimal implementation** (append to `store.py`; also add `import uuid` and `import json` at the top with the existing imports)

```python
# at top of store.py, alongside existing imports:
import json
import uuid


def _uid() -> str:
    return uuid.uuid4().hex


def insert_run(conn, *, run_at, spot_at_issue, spot_source, model_id,
               prompt_version, engine_version, llm_applied) -> str:
    run_id = _uid()
    conn.execute(
        "INSERT INTO runs (run_id, run_at, spot_at_issue, spot_source, "
        "engine_version, prompt_version, model_id, llm_applied) VALUES (?,?,?,?,?,?,?,?)",
        (run_id, run_at, spot_at_issue, spot_source, engine_version,
         prompt_version, model_id, int(bool(llm_applied))),
    )
    conn.commit()
    return run_id


def insert_event(conn, e) -> str:
    event_id = _uid()
    conn.execute(
        "INSERT INTO events (event_id, observed_at, source, signal, value, delta, "
        "interpretation, headline, url, sentiment, raw) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (event_id, e.observed_at, e.source, e.signal, e.value, e.delta,
         e.interpretation, e.headline, e.url, e.sentiment, json.dumps(e.raw)),
    )
    conn.commit()
    return event_id


def link_forecast_event(conn, forecast_id: str, event_id: str) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO forecast_events (forecast_id, event_id) VALUES (?,?)",
        (forecast_id, event_id),
    )
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_store_writes.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/store.py tests/test_store_writes.py
git commit -m "feat(store): insert_run, insert_event, link_forecast_event"
```

---

### Task 3: Store write helper — `insert_forecast` (`store.py`)

**Files:**
- Modify: `src/btc_oracle/store.py`
- Test: `tests/test_store_writes.py` (append)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_store_writes.py  (add)
from btc_oracle.store import insert_forecast
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


def _enriched():
    b = baseline_forecast(spot=65000.0, sigma_daily=0.03, horizon="1w",
                          horizon_days=7, mu_daily=0.0, conf_level=0.60)
    adj = {"drift_adj_bps": 20.0, "vol_mult": 1.1, "skew_adj": 0.0,
           "p_up_override": None, "confidence": "medium"}
    return apply_overlay(b, adj, llm_applied=True)


def test_insert_forecast_maps_all_fields(mem_db):
    rid = insert_run(mem_db, run_at="t0", spot_at_issue=65000.0, spot_source="cg",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=True)
    f = _enriched()
    fid = insert_forecast(mem_db, run_id=rid, target_at="2026-06-10T10:00:00+00:00",
                          forecast=f, rationale="crowded longs", drift_mode="zero")
    row = mem_db.execute("SELECT * FROM forecasts WHERE forecast_id=?", (fid,)).fetchone()
    assert row["horizon"] == "1w"
    assert row["target_at"] == "2026-06-10T10:00:00+00:00"
    assert abs(row["central"] - f.central) < 1e-9
    assert abs(row["baseline_central"] - f.baseline_central) < 1e-9
    assert row["drift_adj_bps"] == 20.0 and row["vol_mult"] == 1.1
    assert row["drift_mode"] == "zero"
    assert row["rationale"] == "crowded longs"
    assert row["resolved"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_store_writes.py::test_insert_forecast_maps_all_fields -v`
Expected: FAIL — `ImportError: cannot import name 'insert_forecast'`

- [ ] **Step 3: Write minimal implementation** (append to `store.py`)

```python
def insert_forecast(conn, *, run_id, target_at, forecast, rationale, drift_mode) -> str:
    f = forecast
    forecast_id = _uid()
    conn.execute(
        "INSERT INTO forecasts (forecast_id, run_id, horizon, target_at, central, lower, "
        "upper, conf_level, p_up, mu_h, sigma_h, confidence_label, band_width_pct, "
        "baseline_central, baseline_p_up, baseline_sigma_h, vol_model, vol_window, "
        "drift_mode, drift_adj_bps, vol_mult, skew_adj, rationale, resolved) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)",
        (forecast_id, run_id, f.horizon, target_at, f.central, f.lower, f.upper,
         f.conf_level, f.p_up, f.mu_h, f.sigma_h, f.confidence_label, f.band_width_pct,
         f.baseline_central, f.baseline_p_up, f.baseline_sigma_h, f.vol_model,
         f.vol_window, drift_mode, f.drift_adj_bps, f.vol_mult, f.skew_adj, rationale),
    )
    conn.commit()
    return forecast_id
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_store_writes.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/store.py tests/test_store_writes.py
git commit -m "feat(store): insert_forecast maps EnrichedForecast to the forecasts table"
```

---

### Task 4: Store resolution + read helpers (`store.py`)

**Files:**
- Modify: `src/btc_oracle/store.py`
- Test: `tests/test_store_writes.py` (append)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_store_writes.py  (add)
from btc_oracle.store import (
    get_unresolved_matured, get_close_on_or_after, mark_resolved, insert_score,
    get_latest_run, get_forecasts_for_run, get_forecast_history, get_scores,
    insert_prices,
)


def _seed_forecast(conn, *, run_at, target_at, spot, horizon="1w"):
    rid = insert_run(conn, run_at=run_at, spot_at_issue=spot, spot_source="cg",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=False)
    f = _enriched()
    fid = insert_forecast(conn, run_id=rid, target_at=target_at, forecast=f,
                          rationale="r", drift_mode="zero")
    return rid, fid


def test_get_unresolved_matured_filters_by_time(mem_db):
    _seed_forecast(mem_db, run_at="2026-06-01T00:00:00+00:00",
                   target_at="2026-06-08T00:00:00+00:00", spot=65000.0)   # matured
    _seed_forecast(mem_db, run_at="2026-06-03T00:00:00+00:00",
                   target_at="2026-07-03T00:00:00+00:00", spot=66000.0)   # future
    rows = get_unresolved_matured(mem_db, "2026-06-10T00:00:00+00:00")
    assert len(rows) == 1
    assert rows[0]["spot_at_issue"] == 65000.0   # joined from runs


def test_get_close_on_or_after(mem_db):
    insert_prices(mem_db, [("coinbase", "1d", 100.0, 0, 0, 0, 10.0, 0),
                           ("coinbase", "1d", 200.0, 0, 0, 0, 20.0, 0)])
    assert get_close_on_or_after(mem_db, "coinbase", "1d", 150.0) == 20.0
    assert get_close_on_or_after(mem_db, "coinbase", "1d", 999.0) is None


def test_mark_resolved_and_insert_score(mem_db):
    _, fid = _seed_forecast(mem_db, run_at="t", target_at="t2", spot=65000.0)
    insert_score(mem_db, {"forecast_id": fid, "horizon": "1w", "resolved_at": "t3",
                          "realized_price": 66000.0, "up_outcome": 1, "brier": 0.16,
                          "brier_base": 0.25, "bss": 0.36, "ae": 1000.0, "ape": 1.5,
                          "mae_ratio": 1.0, "covered": 1})
    mark_resolved(mem_db, fid)
    assert mem_db.execute("SELECT resolved FROM forecasts WHERE forecast_id=?",
                          (fid,)).fetchone()["resolved"] == 1
    s = get_scores(mem_db, "1w")
    assert len(s) == 1 and s[0]["bss"] == 0.36


def test_latest_run_and_history(mem_db):
    _seed_forecast(mem_db, run_at="2026-06-01T00:00:00+00:00", target_at="2026-06-08T00:00:00+00:00", spot=64000.0)
    _seed_forecast(mem_db, run_at="2026-06-02T00:00:00+00:00", target_at="2026-06-09T00:00:00+00:00", spot=65000.0)
    assert get_latest_run(mem_db)["spot_at_issue"] == 65000.0   # newest run_at
    hist = get_forecast_history(mem_db, "1w")
    assert len(hist) == 2 and hist[0]["run_at"] <= hist[1]["run_at"]  # ascending
    fr = get_forecasts_for_run(mem_db, get_latest_run(mem_db)["run_id"])
    assert len(fr) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_store_writes.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_unresolved_matured'`

- [ ] **Step 3: Write minimal implementation** (append to `store.py`)

```python
def get_unresolved_matured(conn, now_iso: str):
    return conn.execute(
        "SELECT f.forecast_id, f.horizon, f.target_at, f.central, f.lower, f.upper, "
        "f.p_up, r.spot_at_issue FROM forecasts f JOIN runs r ON f.run_id = r.run_id "
        "WHERE f.resolved = 0 AND f.target_at <= ? ORDER BY f.target_at ASC",
        (now_iso,),
    ).fetchall()


def get_close_on_or_after(conn, source: str, interval: str, ts_epoch: float):
    row = conn.execute(
        "SELECT close FROM price_history WHERE source=? AND interval=? AND ts >= ? "
        "ORDER BY ts ASC LIMIT 1",
        (source, interval, ts_epoch),
    ).fetchone()
    return row["close"] if row else None


def mark_resolved(conn, forecast_id: str) -> None:
    conn.execute("UPDATE forecasts SET resolved = 1 WHERE forecast_id = ?", (forecast_id,))
    conn.commit()


def insert_score(conn, s: dict) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO scores (forecast_id, horizon, resolved_at, realized_price, "
        "up_outcome, brier, brier_base, bss, crps, crps_rw, ae, ape, mae_ratio, theil_u2, "
        "pit, covered) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (s["forecast_id"], s["horizon"], s["resolved_at"], s["realized_price"],
         s["up_outcome"], s["brier"], s["brier_base"], s.get("bss"), s.get("crps"),
         s.get("crps_rw"), s["ae"], s.get("ape"), s.get("mae_ratio"), s.get("theil_u2"),
         s.get("pit"), s["covered"]),
    )
    conn.commit()


def get_latest_run(conn):
    return conn.execute("SELECT * FROM runs ORDER BY run_at DESC LIMIT 1").fetchone()


def get_forecasts_for_run(conn, run_id: str):
    return conn.execute("SELECT * FROM forecasts WHERE run_id = ?", (run_id,)).fetchall()


def get_forecast_history(conn, horizon: str, limit: int = 1000):
    return conn.execute(
        "SELECT r.run_at, f.target_at, f.central, f.lower, f.upper, f.p_up "
        "FROM forecasts f JOIN runs r ON f.run_id = r.run_id WHERE f.horizon = ? "
        "ORDER BY r.run_at ASC LIMIT ?",
        (horizon, limit),
    ).fetchall()


def get_scores(conn, horizon: str | None = None):
    if horizon is None:
        return conn.execute("SELECT * FROM scores").fetchall()
    return conn.execute("SELECT * FROM scores WHERE horizon = ?", (horizon,)).fetchall()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_store_writes.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/store.py tests/test_store_writes.py
git commit -m "feat(store): resolution and read helpers (matured, close lookup, scores, history)"
```

---

### Task 5: Scoring math (`scoring.py`)

**Files:**
- Create: `src/btc_oracle/scoring.py`
- Test: `tests/test_scoring.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_scoring.py
from btc_oracle.scoring import score_forecast


def test_up_move_scores():
    # spot 100 -> realized 110 (up). Forecast was bullish (p_up 0.7), central 108, band [95,120].
    s = score_forecast(p_up=0.7, central=108.0, lower=95.0, upper=120.0,
                       spot_at_issue=100.0, realized=110.0)
    assert s["up_outcome"] == 1
    assert abs(s["brier"] - (0.7 - 1) ** 2) < 1e-12          # 0.09
    assert abs(s["brier_base"] - (0.5 - 1) ** 2) < 1e-12     # 0.25
    assert abs(s["bss"] - (1 - 0.09 / 0.25)) < 1e-12         # 0.64
    assert abs(s["ae"] - 2.0) < 1e-12                        # |110-108|
    assert abs(s["ape"] - (2.0 / 110.0 * 100)) < 1e-9
    assert abs(s["mae_ratio"] - (2.0 / 10.0)) < 1e-12        # rw error |110-100|=10
    assert s["covered"] == 1                                 # 95<=110<=120


def test_down_move_and_miss_outside_band():
    s = score_forecast(p_up=0.6, central=100.0, lower=98.0, upper=102.0,
                       spot_at_issue=100.0, realized=90.0)
    assert s["up_outcome"] == 0
    assert abs(s["brier"] - 0.36) < 1e-12                    # (0.6-0)^2
    assert s["covered"] == 0                                 # 90 < 98


def test_no_move_counts_as_not_up():
    s = score_forecast(p_up=0.5, central=100.0, lower=90.0, upper=110.0,
                       spot_at_issue=100.0, realized=100.0)
    assert s["up_outcome"] == 0          # strict: realized > spot required for "up"
    assert s["mae_ratio"] is None        # rw error is 0 -> undefined ratio
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_scoring.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.scoring'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/scoring.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_scoring.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/scoring.py tests/test_scoring.py
git commit -m "feat(scoring): Brier/BSS/MAPE/coverage vs random-walk baseline"
```

---

### Task 6: Resolution engine (`resolve.py`)

**Files:**
- Create: `src/btc_oracle/resolve.py`
- Test: `tests/test_resolve.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_resolve.py
from datetime import datetime, timezone, timedelta
from btc_oracle.resolve import resolve_matured
from btc_oracle.store import (insert_run, insert_forecast, insert_prices, get_scores)
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


def _enriched(spot, central, lower, upper, p_up):
    # Build a minimal EnrichedForecast with chosen band by hand via apply_overlay then override-free
    b = baseline_forecast(spot=spot, sigma_daily=0.03, horizon="1w", horizon_days=7,
                          mu_daily=0.0, conf_level=0.60)
    f = apply_overlay(b, {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
                          "p_up_override": p_up, "confidence": "medium"}, llm_applied=False)
    return f


def test_resolves_matured_forecast_and_writes_score(mem_db):
    target = datetime(2026, 6, 8, tzinfo=timezone.utc)
    target_iso = target.isoformat()
    # a realized daily close exactly at the target date
    insert_prices(mem_db, [("coinbase", "1d", target.timestamp(), 0, 0, 0, 71000.0, 0)])
    rid = insert_run(mem_db, run_at="2026-06-01T00:00:00+00:00", spot_at_issue=65000.0,
                     spot_source="cg", model_id="m", prompt_version="v",
                     engine_version="e", llm_applied=False)
    f = _enriched(65000.0, 65000.0, 60000.0, 70000.0, 0.6)
    insert_forecast(mem_db, run_id=rid, target_at=target_iso, forecast=f,
                    rationale="r", drift_mode="zero")

    now = "2026-06-10T00:00:00+00:00"
    out = resolve_matured(mem_db, now)
    assert len(out) == 1
    s = get_scores(mem_db, "1w")[0]
    assert s["realized_price"] == 71000.0
    assert s["up_outcome"] == 1            # 71000 > 65000
    assert s["covered"] == 0               # 71000 > upper 70000


def test_skips_when_no_price_yet(mem_db):
    rid = insert_run(mem_db, run_at="t", spot_at_issue=65000.0, spot_source="cg",
                     model_id="m", prompt_version="v", engine_version="e", llm_applied=False)
    f = _enriched(65000.0, 65000.0, 60000.0, 70000.0, 0.5)
    insert_forecast(mem_db, run_id=rid, target_at="2026-06-08T00:00:00+00:00",
                    forecast=f, rationale="r", drift_mode="zero")
    # no price_history rows -> cannot resolve
    out = resolve_matured(mem_db, "2026-06-10T00:00:00+00:00")
    assert out == []
    assert get_scores(mem_db, "1w") == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_resolve.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.resolve'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/resolve.py
from datetime import datetime
from .scoring import score_forecast
from .store import (get_unresolved_matured, get_close_on_or_after, insert_score, mark_resolved)


def _iso_to_epoch(iso: str) -> float:
    return datetime.fromisoformat(iso).timestamp()


def resolve_matured(conn, now_iso: str, source: str = "coinbase", interval: str = "1d") -> list:
    """Score every matured-but-unresolved forecast whose realized price is available.
    Forecasts whose target date has no price in history yet are left for a later run."""
    resolved = []
    for row in get_unresolved_matured(conn, now_iso):
        realized = get_close_on_or_after(conn, source, interval, _iso_to_epoch(row["target_at"]))
        if realized is None:
            continue
        s = score_forecast(p_up=row["p_up"], central=row["central"], lower=row["lower"],
                           upper=row["upper"], spot_at_issue=row["spot_at_issue"],
                           realized=realized)
        s.update({"forecast_id": row["forecast_id"], "horizon": row["horizon"],
                  "resolved_at": now_iso, "realized_price": realized})
        insert_score(conn, s)
        mark_resolved(conn, row["forecast_id"])
        resolved.append(s)
    return resolved
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_resolve.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/resolve.py tests/test_resolve.py
git commit -m "feat(resolve): match matured forecasts to realized price and score them"
```

---

### Task 7: Snapshot emitter (`snapshots.py`)

**Files:**
- Create: `src/btc_oracle/snapshots.py`
- Test: `tests/test_snapshots.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_snapshots.py
import json
from btc_oracle.snapshots import build_latest, build_history, build_scores, write_snapshots
from btc_oracle.store import insert_run, insert_forecast, insert_score
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


def _f(horizon, days):
    b = baseline_forecast(spot=65000.0, sigma_daily=0.03, horizon=horizon,
                          horizon_days=days, mu_daily=0.0, conf_level=0.60)
    return apply_overlay(b, {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
                             "p_up_override": None, "confidence": "low"}, llm_applied=False)


def _seed_run(conn, run_at, spot):
    rid = insert_run(conn, run_at=run_at, spot_at_issue=spot, spot_source="cg",
                     model_id="claude-sonnet-4-6", prompt_version="v",
                     engine_version="0.1.0", llm_applied=True)
    for h, d in (("1w", 7), ("1m", 30), ("1y", 365)):
        insert_forecast(conn, run_id=rid, target_at=f"2026-07-0{1}T00:00:00+00:00",
                        forecast=_f(h, d), rationale="why", drift_mode="zero")
    return rid


def test_build_latest_uses_newest_run(mem_db):
    _seed_run(mem_db, "2026-06-01T00:00:00+00:00", 64000.0)
    _seed_run(mem_db, "2026-06-03T00:00:00+00:00", 65000.0)
    latest = build_latest(mem_db)
    assert latest["spot"] == 65000.0
    assert latest["llm_applied"] is True
    assert {f["horizon"] for f in latest["forecasts"]} == {"1w", "1m", "1y"}
    assert "rationale" in latest["forecasts"][0]


def test_build_history_groups_by_horizon(mem_db):
    _seed_run(mem_db, "2026-06-01T00:00:00+00:00", 64000.0)
    _seed_run(mem_db, "2026-06-03T00:00:00+00:00", 65000.0)
    hist = build_history(mem_db)
    assert set(hist.keys()) == {"1w", "1m", "1y"}
    assert len(hist["1w"]) == 2


def test_build_scores_aggregates(mem_db):
    rid = _seed_run(mem_db, "2026-06-01T00:00:00+00:00", 64000.0)
    fid = mem_db.execute("SELECT forecast_id FROM forecasts WHERE horizon='1w'").fetchone()["forecast_id"]
    insert_score(mem_db, {"forecast_id": fid, "horizon": "1w", "resolved_at": "t",
                          "realized_price": 66000.0, "up_outcome": 1, "brier": 0.09,
                          "brier_base": 0.25, "bss": 0.64, "ae": 1000.0, "ape": 1.5,
                          "mae_ratio": 0.5, "covered": 1})
    sc = build_scores(mem_db)
    assert sc["1w"]["n"] == 1
    assert abs(sc["1w"]["brier"] - 0.09) < 1e-9
    assert sc["1y"]["n"] == 0


def test_write_snapshots_emits_three_files(mem_db, tmp_path):
    _seed_run(mem_db, "2026-06-01T00:00:00+00:00", 64000.0)
    written = write_snapshots(mem_db, str(tmp_path))
    assert set(written) == {"latest.json", "history.json", "scores.json"}
    data = json.loads((tmp_path / "latest.json").read_text())
    assert data["spot"] == 64000.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.snapshots'`

- [ ] **Step 3: Write minimal implementation**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/snapshots.py tests/test_snapshots.py
git commit -m "feat(snapshots): render latest/history/scores JSON for the dashboard"
```

---

### Task 8: Hourly orchestrator (`run_hourly.py`)

**Files:**
- Create: `src/btc_oracle/run_hourly.py`
- Test: `tests/test_run_hourly.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_run_hourly.py
import json
from btc_oracle.run_hourly import run_once
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings():
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94, mu_daily=0.0,
                    anthropic_api_key=None, coingecko_demo_key=None)


def _http_get(url, params, headers):
    if "alternative.me" in url:
        return {"data": [{"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
    if "funding" in url:
        return {"result": {"list": [{"fundingRate": "0.00008", "fundingRateTimestamp": "1780502400000"}]}}
    if "open-interest" in url:
        return {"result": {"list": [{"openInterest": "59000", "timestamp": "1780509600000"}]}}
    if "gdelt" in url:
        return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
    raise AssertionError(url)


def test_run_once_persists_run_forecasts_events_and_snapshots(mem_db, tmp_path):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    summary = run_once(mem_db, _settings(), now_iso="2026-06-03T10:00:00+00:00",
                       spot=140.0, http_get=_http_get, claude_call=None,
                       out_dir=str(tmp_path), model_id="baseline-only")
    assert summary["forecasts"] == 3
    assert summary["events"] >= 4               # fng, funding, oi, gdelt
    assert summary["resolved"] == 0             # nothing matured yet
    assert mem_db.execute("SELECT COUNT(*) c FROM runs").fetchone()["c"] == 1
    assert mem_db.execute("SELECT COUNT(*) c FROM forecasts").fetchone()["c"] == 3
    assert mem_db.execute("SELECT COUNT(*) c FROM forecast_events").fetchone()["c"] == 3 * summary["events"]
    # target_at = now + horizon days
    row = mem_db.execute("SELECT target_at FROM forecasts WHERE horizon='1w'").fetchone()
    assert row["target_at"].startswith("2026-06-10")
    data = json.loads((tmp_path / "latest.json").read_text())
    assert len(data["forecasts"]) == 3


def test_run_once_resolves_a_matured_prior_forecast(mem_db, tmp_path):
    # a prior 1w forecast issued at spot 100, target already passed, realized price present
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    from btc_oracle.store import insert_run, insert_forecast
    from btc_oracle.baseline import baseline_forecast
    from btc_oracle.overlay import apply_overlay
    from datetime import datetime, timezone
    target = datetime(2026, 6, 1, tzinfo=timezone.utc)
    insert_prices(mem_db, [("coinbase", "1d", target.timestamp(), 0, 0, 0, 130.0, 0)])
    rid = insert_run(mem_db, run_at="2026-05-25T00:00:00+00:00", spot_at_issue=120.0,
                     spot_source="cg", model_id="m", prompt_version="v",
                     engine_version="e", llm_applied=False)
    b = baseline_forecast(spot=120.0, sigma_daily=0.03, horizon="1w", horizon_days=7,
                          mu_daily=0.0, conf_level=0.60)
    f = apply_overlay(b, {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
                          "p_up_override": None, "confidence": "low"}, llm_applied=False)
    insert_forecast(mem_db, run_id=rid, target_at=target.isoformat(), forecast=f,
                    rationale="r", drift_mode="zero")

    summary = run_once(mem_db, _settings(), now_iso="2026-06-03T10:00:00+00:00",
                       spot=140.0, http_get=_http_get, claude_call=None,
                       out_dir=str(tmp_path), model_id="baseline-only")
    assert summary["resolved"] == 1
    assert mem_db.execute("SELECT COUNT(*) c FROM scores").fetchone()["c"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_run_hourly.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.run_hourly'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/run_hourly.py
from datetime import datetime, timedelta
from .store import (insert_run, insert_event, insert_forecast, link_forecast_event)
from .resolve import resolve_matured
from .snapshots import write_snapshots


def run_once(conn, settings, *, now_iso, spot, http_get, claude_call, out_dir, model_id="baseline-only"):
    """One full hourly cycle: build event-aware forecasts, persist them, resolve any
    matured prior forecasts, and emit JSON snapshots. Returns a summary dict."""
    from .cli import build_enriched_forecasts  # local import avoids a cli<->run_hourly cycle

    forecasts, rationale, llm_applied, events = build_enriched_forecasts(
        conn, settings, spot=spot, http_get=http_get, claude_call=claude_call)

    run_id = insert_run(conn, run_at=now_iso, spot_at_issue=spot, spot_source="coingecko",
                        model_id=model_id, prompt_version="v1", engine_version="0.1.0",
                        llm_applied=llm_applied)
    drift_mode = "zero" if settings.mu_daily == 0 else f"mu={settings.mu_daily}"
    event_ids = [insert_event(conn, e) for e in events]

    base_dt = datetime.fromisoformat(now_iso)
    for f in forecasts:
        target_at = (base_dt + timedelta(days=f.horizon_days)).isoformat()
        fid = insert_forecast(conn, run_id=run_id, target_at=target_at, forecast=f,
                              rationale=rationale, drift_mode=drift_mode)
        for eid in event_ids:
            link_forecast_event(conn, fid, eid)

    resolved = resolve_matured(conn, now_iso)
    written = write_snapshots(conn, out_dir)
    return {"run_id": run_id, "forecasts": len(forecasts), "events": len(event_ids),
            "resolved": len(resolved), "llm_applied": llm_applied, "snapshots": written}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_run_hourly.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/run_hourly.py tests/test_run_hourly.py
git commit -m "feat(run_hourly): orchestrate build -> persist -> resolve -> snapshot"
```

---

### Task 9: `run` CLI command (the cron entry point)

**Files:**
- Modify: `src/btc_oracle/cli.py`
- Test: `tests/test_cli_run.py`

- [ ] **Step 1: Write the failing test** (tests the injectable core; real network exercised in Step 6)

```python
# tests/test_cli_run.py
import json
from btc_oracle.cli import run_cycle
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings(tmp):
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94, mu_daily=0.0,
                    anthropic_api_key=None, coingecko_demo_key=None, snapshot_dir=str(tmp))


def _http_get(url, params, headers):
    if "alternative.me" in url:
        return {"data": [{"value": "20", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
    return {"result": {"list": []}, "timeline": []}  # other sources empty -> fail soft


def test_run_cycle_writes_snapshots_to_settings_dir(mem_db, tmp_path):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    summary = run_cycle(mem_db, _settings(tmp_path), now_iso="2026-06-03T10:00:00+00:00",
                        spot=140.0, http_get=_http_get, claude_call=None)
    assert summary["forecasts"] == 3
    assert (tmp_path / "latest.json").exists()
    assert json.loads((tmp_path / "scores.json").read_text())["1w"]["n"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_cli_run.py -v`
Expected: FAIL — `ImportError: cannot import name 'run_cycle'`

- [ ] **Step 3: Write minimal implementation** (modify `cli.py`)

Add this import near the other local imports at the top of `cli.py`:
```python
from datetime import datetime, timezone
```

Add the thin core + command (place after `cmd_preview`):
```python
def run_cycle(conn, settings, *, now_iso, spot, http_get, claude_call):
    """Injectable core of the hourly run (no global state / network)."""
    from .run_hourly import run_once
    model_id = "claude-sonnet-4-6" if settings.anthropic_api_key else "baseline-only"
    return run_once(conn, settings, now_iso=now_iso, spot=spot, http_get=http_get,
                    claude_call=claude_call, out_dir=settings.snapshot_dir, model_id=model_id)


def cmd_run(settings):
    conn = connect(settings.db_path)
    init_schema(conn)
    # keep price history fresh for vol + resolution
    backfill(conn, ccxt.coinbase(), source="coinbase", symbol="BTC/USD", timeframe="1d")
    spot = fetch_spot(_httpx_get, demo_key=settings.coingecko_demo_key)
    claude_call = (make_claude_call(settings.anthropic_api_key)
                   if settings.anthropic_api_key else None)
    now_iso = datetime.now(timezone.utc).isoformat()
    summary = run_cycle(conn, settings, now_iso=now_iso, spot=spot,
                        http_get=_httpx_get, claude_call=claude_call)
    print(f"run {summary['run_id'][:8]}: forecasts={summary['forecasts']} "
          f"events={summary['events']} resolved={summary['resolved']} "
          f"llm_applied={summary['llm_applied']} -> {settings.snapshot_dir}")
```

Register the subcommand in `main()` (modify the existing body):
```python
    sub.add_parser("run", help="full hourly cycle: forecast -> persist -> resolve -> snapshot")
```
and add `"run": cmd_run` to the dispatch dict:
```python
    {"backfill": cmd_backfill, "baseline": cmd_baseline,
     "preview": cmd_preview, "run": cmd_run}[args.cmd](settings)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_cli_run.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Run the FULL suite**

Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (all Plans 1–3 tests green)

- [ ] **Step 6: Manual smoke test (no API key — full hourly cycle against live keyless APIs)**

Run:
```bash
.venv/Scripts/python -m btc_oracle.cli run
ls public_html/data
```
Expected: prints `run <id>: forecasts=3 events=N resolved=0 llm_applied=False -> ./public_html/data`, and `public_html/data/` contains `latest.json`, `history.json`, `scores.json`. Open `latest.json` — it holds the spot, three forecasts with bands + P(up), and the rationale. (With `ANTHROPIC_API_KEY` set, `llm_applied=True` and a real bounded nudge appears.)

- [ ] **Step 7: Commit**

```bash
git add src/btc_oracle/cli.py tests/test_cli_run.py
git commit -m "feat(cli): run command — the hourly cron entry point"
```

---

## Self-Review

**1. Spec coverage (this plan's slice — §7 scoring, §8 persistence, §4 data flow):**
- §8 persistence of runs/forecasts/events/links → Tasks 2–3 + run_hourly (Task 8) ✓ ; all EnrichedForecast fields + baseline_* audit columns mapped (Task 3) ✓
- §7 scoring vs random walk: Brier, Brier-base (p=0.5), BSS, MAPE, MAE-ratio, coverage → `scoring` (Task 5) ✓ ; CRPS/PIT/Theil/DM are Phase-2 columns left null (documented) ✓
- §7 per-horizon, never blended; 1y "insufficient data" until resolved → `build_scores` returns `{"n":0}` per empty horizon (Task 7) ✓ (the dashboard renders "insufficient data" from n=0)
- resolution matches matured forecasts to realized price; un-matured left for later → `resolve_matured` (Task 6) ✓
- §4 static JSON snapshots (latest/history/scores) the browser reads → `snapshots` (Task 7) + written to `settings.snapshot_dir` (Tasks 1, 9) ✓
- hourly entry point for cron → `cli run` / `cmd_run` (Task 9) ✓
- Out of this plan (correctly): dashboard rendering → Plan 4; cPanel cron wiring/deploy → Plan 5.

**2. Placeholder scan:** No TBD/TODO. Every step has complete code + exact commands/expected output. The cli/run_hourly circular import is resolved explicitly with a documented local import.

**3. Type consistency:** `insert_run` kwargs match every call site (Tasks 2/4/6/7/8 tests + run_hourly). `insert_forecast(run_id, target_at, forecast, rationale, drift_mode)` matches Task 3/4/6/7 tests + run_hourly. `score_forecast(p_up, central, lower, upper, spot_at_issue, realized)->dict` keys (`up_outcome,brier,brier_base,bss,ae,ape,mae_ratio,covered`) are produced in Task 5 and consumed by `insert_score` (Task 4) + `build_scores` (Task 7). `get_unresolved_matured` row columns (`forecast_id,horizon,target_at,central,lower,upper,p_up,spot_at_issue`) are exactly what `resolve_matured` reads. `run_once(conn, settings, *, now_iso, spot, http_get, claude_call, out_dir, model_id)` matches `run_cycle` (Task 9) and tests. `write_snapshots(conn, out_dir)->list[str]` matches run_once + cli. `Settings.snapshot_dir` (Task 1) is read by `run_cycle` (Task 9). `build_enriched_forecasts` is reused (not redefined) via local import in run_once.

---

## Next plans (not part of this one)
- **Plan 4:** Next.js static-export "command dashboard" (Recharts) reading `/data/{latest,history,scores}.json` — horizon cards, forecast-vs-actual chart, accuracy scorecard, "why it moved", disclaimer.
- **Plan 5:** cPanel deploy — Python app + real hourly cron running `btc-oracle run`, secrets in gitignored `.env`, static export into `public_html`, AutoSSL verification, then rotate the shared cPanel password.

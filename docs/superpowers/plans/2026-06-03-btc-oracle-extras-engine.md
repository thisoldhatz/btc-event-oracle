# BTC Oracle — Extras Feed (timeline + results) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose two new data feeds the dashboard's engagement features need, in a new `extras.json`
snapshot: a run-level **timeline** (rationale + 1-week direction over time → "how the model changed its
mind") and **results** (recently-resolved forecasts with predicted-vs-actual → the "called it" reveals).

**Architecture:** Two read-only `store` queries + a `build_extras(conn)` in `snapshots.py` that
`write_snapshots` emits as `extras.json`. No orchestrator changes (it reads straight from the DB).
Additive — existing snapshots/tests unchanged. This is the engine half of the engagement upgrade.

**Tech Stack:** Python 3.10+, stdlib only.

**New snapshot file `extras.json`:**
```jsonc
{ "timeline": [   // run-level, newest-first, last ~72 runs — the 1w forecast represents "direction"
    { "run_at": "...", "p_up": 0.49, "central": 65162.0, "drift_adj_bps": -15.0, "vol_mult": 1.15,
      "confidence_label": "low", "llm_applied": true, "rationale": "Extreme Fear ..." } ],
  "results": [     // resolved forecasts, newest-first, last ~30
    { "horizon": "1w", "run_at": "...", "target_at": "...", "central": 65000.0, "lower": 61000.0,
      "upper": 69000.0, "p_up": 0.55, "spot_at_issue": 64000.0, "realized_price": 66000.0,
      "up_outcome": 1, "covered": true } ] }
```
Both are **empty at first** (no forecasts have matured; timeline grows each hour) — the dashboard must
render graceful empty states. `up_outcome` is 1 if the price rose; the frontend computes
`predicted_up = p_up >= 0.5` and `direction_hit = (predicted_up == up_outcome)`.

**Existing interfaces (don't change):** `store.get_latest_run/get_forecasts_for_run`, `snapshots.build_latest/build_history/build_scores/write_snapshots`. Tables per spec §8.

---

## File structure
```
src/btc_oracle/store.py       # + get_timeline(conn, limit), get_results(conn, limit)
src/btc_oracle/snapshots.py   # + build_extras(conn); write_snapshots also emits extras.json
tests/test_extras.py
```

---

### Task 1: Store queries — timeline + results (`store.py`)

**Files:**
- Modify: `src/btc_oracle/store.py`
- Test: `tests/test_extras.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_extras.py
from btc_oracle.store import (insert_run, insert_forecast, insert_score, get_timeline, get_results)
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay


def _f(p_up):
    b = baseline_forecast(spot=65000.0, sigma_daily=0.03, horizon="1w", horizon_days=7,
                          mu_daily=0.0, conf_level=0.60)
    return apply_overlay(b, {"drift_adj_bps": -15.0, "vol_mult": 1.15, "skew_adj": 0.0,
                             "p_up_override": p_up, "confidence": "low"}, llm_applied=True)


def _seed_run(conn, run_at, spot, p_up=0.5, rationale="r"):
    rid = insert_run(conn, run_at=run_at, spot_at_issue=spot, spot_source="cg", model_id="m",
                     prompt_version="v", engine_version="e", llm_applied=True)
    for h, d in (("1w", 7), ("1m", 30), ("1y", 365)):
        f = _f(p_up)
        fid = insert_forecast(conn, run_id=rid, target_at=run_at, forecast=f,
                              rationale=rationale, drift_mode="zero")
        if h == "1w":
            conn.execute("UPDATE forecasts SET horizon='1w' WHERE forecast_id=?", (fid,))
    conn.commit()
    return rid


def test_get_timeline_is_newest_first_and_one_per_run(mem_db):
    _seed_run(mem_db, "2026-06-03T20:00:00+00:00", 64000.0, p_up=0.45, rationale="cautious")
    _seed_run(mem_db, "2026-06-03T21:00:00+00:00", 65000.0, p_up=0.55, rationale="optimistic")
    rows = get_timeline(mem_db, limit=10)
    assert rows[0]["run_at"] == "2026-06-03T21:00:00+00:00"     # newest first
    assert rows[0]["rationale"] == "optimistic"
    assert abs(rows[0]["p_up"] - 0.55) < 1e-9
    assert "drift_adj_bps" in rows[0].keys()
    # one entry per run (the 1w forecast), not 3
    assert len(rows) == 2


def test_get_results_returns_resolved_with_predicted_and_actual(mem_db):
    rid = _seed_run(mem_db, "2026-05-27T00:00:00+00:00", 64000.0, p_up=0.6)
    fid = mem_db.execute("SELECT forecast_id FROM forecasts WHERE run_id=? AND horizon='1w'", (rid,)).fetchone()["forecast_id"]
    insert_score(mem_db, {"forecast_id": fid, "horizon": "1w", "resolved_at": "2026-06-03T00:00:00+00:00",
                          "realized_price": 66000.0, "up_outcome": 1, "brier": 0.16, "brier_base": 0.25,
                          "bss": 0.36, "ae": 1000.0, "ape": 1.5, "mae_ratio": 1.0, "covered": 1})
    rows = get_results(mem_db, limit=10)
    assert len(rows) == 1
    r = rows[0]
    assert r["horizon"] == "1w"
    assert r["realized_price"] == 66000.0
    assert r["up_outcome"] == 1
    assert r["spot_at_issue"] == 64000.0
    assert "central" in r.keys() and "lower" in r.keys() and "p_up" in r.keys()


def test_empty_when_nothing(mem_db):
    assert get_timeline(mem_db) == []
    assert get_results(mem_db) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_extras.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_timeline'`

- [ ] **Step 3: Write minimal implementation** (append to `store.py`)

```python
def get_timeline(conn, limit: int = 72):
    """Run-level history (the 1w forecast represents direction), newest first."""
    return conn.execute(
        "SELECT r.run_at, r.llm_applied, f.p_up, f.central, f.drift_adj_bps, f.vol_mult, "
        "f.confidence_label, f.rationale FROM runs r JOIN forecasts f ON f.run_id = r.run_id "
        "WHERE f.horizon = '1w' ORDER BY r.run_at DESC LIMIT ?",
        (limit,),
    ).fetchall()


def get_results(conn, limit: int = 30):
    """Resolved forecasts with predicted (central/band/p_up + spot at issue) and actual
    (realized price, up outcome, coverage), newest-resolved first."""
    return conn.execute(
        "SELECT s.horizon, s.realized_price, s.up_outcome, s.covered, s.resolved_at, "
        "r.run_at, r.spot_at_issue, f.target_at, f.central, f.lower, f.upper, f.p_up "
        "FROM scores s JOIN forecasts f ON f.forecast_id = s.forecast_id "
        "JOIN runs r ON r.run_id = f.run_id ORDER BY s.resolved_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_extras.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/store.py tests/test_extras.py
git commit -m "feat(store): timeline + resolved-results queries for the extras feed"
```

---

### Task 2: build_extras + emit extras.json (`snapshots.py`)

**Files:**
- Modify: `src/btc_oracle/snapshots.py`
- Test: `tests/test_extras.py` (append)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_extras.py  (add)
import json
from btc_oracle.snapshots import build_extras, write_snapshots


def test_build_extras_shapes(mem_db):
    _seed_run(mem_db, "2026-06-03T21:00:00+00:00", 65000.0, p_up=0.55, rationale="why")
    extras = build_extras(mem_db)
    assert set(extras.keys()) == {"timeline", "results"}
    assert extras["timeline"][0]["rationale"] == "why"
    assert extras["timeline"][0]["llm_applied"] is True
    assert extras["results"] == []        # nothing resolved


def test_write_snapshots_emits_extras_json(mem_db, tmp_path):
    _seed_run(mem_db, "2026-06-03T21:00:00+00:00", 65000.0)
    written = write_snapshots(mem_db, str(tmp_path))
    assert "extras.json" in written
    data = json.loads((tmp_path / "extras.json").read_text())
    assert "timeline" in data and "results" in data
    assert len(data["timeline"]) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_extras.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_extras'`

- [ ] **Step 3: Write minimal implementation** (modify `snapshots.py`)

Add the imports for the new queries (extend the existing `from .store import (...)`):
```python
from .store import (get_latest_run, get_forecasts_for_run, get_forecast_history, get_scores,
                    get_timeline, get_results)
```

Add `build_extras`:
```python
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
```

Add `extras.json` to the `write_snapshots` payloads dict (modify the existing dict literal):
```python
    payloads = {"latest.json": build_latest(conn, signals=signals, news=news),
                "history.json": build_history(conn),
                "scores.json": build_scores(conn),
                "extras.json": build_extras(conn)}
```

- [ ] **Step 4: Run test to verify it passes + full suite**

Run: `.venv/Scripts/python -m pytest tests/test_extras.py -v`
Expected: PASS (5 passed)
Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (whole suite green — additive change).

- [ ] **Step 5: Manual smoke**

Run:
```bash
.venv/Scripts/python -m btc_oracle.cli run
.venv/Scripts/python -c "import json;d=json.load(open('public_html/data/extras.json'));print('timeline',len(d['timeline']),'| results',len(d['results']));print(d['timeline'][0]['rationale'][:60] if d['timeline'] else 'none')"
```
Expected: prints a timeline count ≥ 1 with the latest rationale, and results (0 until forecasts mature).

- [ ] **Step 6: Commit**

```bash
git add src/btc_oracle/snapshots.py tests/test_extras.py
git commit -m "feat(snapshots): emit extras.json (timeline + resolved results)"
```

---

## Self-Review

**1. Coverage:** run-level rationale/direction timeline + resolved-results feed → `get_timeline`/`get_results` (Task 1) + `build_extras`/`extras.json` (Task 2). Additive; existing snapshots + tests untouched (`write_snapshots` only gains a key). Both feeds degrade to `[]` cleanly when empty.

**2. Placeholder scan:** No TBD/TODO; complete SQL + code + commands. The two modify-blocks (extend the store import; add the payloads key) are exact.

**3. Type consistency:** `get_timeline` row columns (`run_at, llm_applied, p_up, central, drift_adj_bps, vol_mult, confidence_label, rationale`) are exactly what `build_extras` reads. `get_results` columns (`horizon, realized_price, up_outcome, covered, resolved_at, run_at, spot_at_issue, target_at, central, lower, upper, p_up`) match `build_extras`. `build_extras(conn)->{timeline,results}` matches the frontend types to come. `write_snapshots` return list now includes `"extras.json"` (asserted).

---

## Next plan
- **Dashboard engagement features** (built against `extras.json` + CoinGecko history): actual-price overlay on the chart, countdowns + "called it" reveals, the "how the model changed its mind" timeline, and visual polish (Fear & Greed dial, price sparkline, number count-up, term tooltips).

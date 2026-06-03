import json
import sqlite3
import uuid
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

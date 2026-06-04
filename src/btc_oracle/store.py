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
CREATE TABLE IF NOT EXISTS markets (
  market_id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  question TEXT, threshold REAL, direction TEXT, end_date TEXT,
  market_prob REAL, model_prob REAL, spot_at_capture REAL,
  resolved INTEGER DEFAULT 0,
  outcome INTEGER, realized_price REAL,
  market_brier REAL, model_brier REAL, resolved_at TEXT
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
    UPSERTS on (source, interval, ts): re-fetching a still-forming daily candle
    OVERWRITES the prior (often partial) values with the latest, instead of
    freezing the day's close at its first intraday reading (which previously
    poisoned both the vol inputs and the realized price used for scoring).
    Returns the number of rows inserted-or-updated."""
    cur = conn.executemany(
        "INSERT INTO price_history "
        "(source, interval, ts, open, high, low, close, volume) "
        "VALUES (?,?,?,?,?,?,?,?) "
        "ON CONFLICT(source, interval, ts) DO UPDATE SET "
        "open=excluded.open, high=excluded.high, low=excluded.low, "
        "close=excluded.close, volume=excluded.volume",
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
         f.conf_level, f.p_up, f.mu_h, f.sigma_h,
         getattr(f, "confidence_label", None), getattr(f, "band_width_pct", None),
         getattr(f, "baseline_central", None), getattr(f, "baseline_p_up", None),
         getattr(f, "baseline_sigma_h", None), f.vol_model,
         f.vol_window, drift_mode,
         getattr(f, "drift_adj_bps", None), getattr(f, "vol_mult", None),
         getattr(f, "skew_adj", None), rationale),
    )
    conn.commit()
    return forecast_id


def get_unresolved_matured(conn, now_iso: str):
    return conn.execute(
        "SELECT f.forecast_id, f.horizon, f.target_at, f.central, f.lower, f.upper, f.p_up, "
        "f.mu_h, f.sigma_h, f.conf_level, f.baseline_central, f.baseline_p_up, f.baseline_sigma_h, "
        "r.spot_at_issue FROM forecasts f JOIN runs r ON f.run_id = r.run_id "
        "WHERE f.resolved = 0 AND f.target_at <= ? ORDER BY f.target_at ASC",
        (now_iso,),
    ).fetchall()


def get_scored_detail(conn, horizon: str):
    """Everything needed to aggregate rich scores for one horizon, newest-resolved first."""
    return conn.execute(
        "SELECT s.realized_price, s.up_outcome, s.covered, s.crps, s.crps_rw, s.pit, "
        "s.brier, s.brier_base, s.ape, s.resolved_at, "
        "f.p_up, f.central, f.sigma_h, f.mu_h, f.conf_level, "
        "f.baseline_p_up, f.baseline_central, f.baseline_sigma_h, r.spot_at_issue "
        "FROM scores s JOIN forecasts f ON f.forecast_id = s.forecast_id "
        "JOIN runs r ON r.run_id = f.run_id WHERE s.horizon = ? ORDER BY f.target_at DESC",
        (horizon,),
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


def get_latest_run_with_forecasts(conn):
    """The newest run that actually HAS forecasts — so a half-written/failed run
    (a runs row with zero forecasts) never surfaces as a live, empty forecast."""
    return conn.execute(
        "SELECT r.* FROM runs r WHERE EXISTS "
        "(SELECT 1 FROM forecasts f WHERE f.run_id = r.run_id) "
        "ORDER BY r.run_at DESC LIMIT 1"
    ).fetchone()


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


def get_timeline(conn, limit: int = 72):
    """Run-level history (the 1w forecast represents direction), newest first."""
    return conn.execute(
        "SELECT r.run_at, r.llm_applied, f.p_up, f.central, f.drift_adj_bps, f.vol_mult, "
        "f.confidence_label, f.rationale FROM runs r JOIN forecasts f ON f.run_id = r.run_id "
        "WHERE f.horizon = '1w' ORDER BY r.run_at DESC LIMIT ?",
        (limit,),
    ).fetchall()


def insert_market_once(conn, m: dict) -> bool:
    """Capture a market's quote the FIRST time it's seen (so we score the at-issue
    odds for a fair head-to-head, not a later one). Returns True if newly inserted."""
    cur = conn.execute(
        "INSERT OR IGNORE INTO markets (market_id, captured_at, question, threshold, "
        "direction, end_date, market_prob, model_prob, spot_at_capture) VALUES (?,?,?,?,?,?,?,?,?)",
        (m["market_id"], m["captured_at"], m["question"], m["threshold"], m["direction"],
         m["end_date"], m["market_prob"], m["model_prob"], m["spot_at_capture"]),
    )
    conn.commit()
    return cur.rowcount > 0


def get_unresolved_markets(conn, now_iso: str):
    return conn.execute(
        "SELECT * FROM markets WHERE resolved=0 AND end_date IS NOT NULL AND end_date <= ?",
        (now_iso,),
    ).fetchall()


def resolve_market(conn, market_id, *, outcome, realized, market_brier, model_brier, resolved_at):
    conn.execute(
        "UPDATE markets SET resolved=1, outcome=?, realized_price=?, market_brier=?, "
        "model_brier=?, resolved_at=? WHERE market_id=?",
        (outcome, realized, market_brier, model_brier, resolved_at, market_id),
    )
    conn.commit()


def get_resolved_markets(conn, limit: int = 200):
    return conn.execute(
        "SELECT * FROM markets WHERE resolved=1 ORDER BY resolved_at DESC LIMIT ?", (limit,)
    ).fetchall()


def get_signal_history(conn, signal: str, limit: int = 400):
    """Recent observed values for one signal (newest first) — powers the
    per-signal SEO explainer pages."""
    return conn.execute(
        "SELECT observed_at, value, delta, interpretation FROM events "
        "WHERE signal=? AND value IS NOT NULL ORDER BY observed_at DESC LIMIT ?",
        (signal, limit),
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

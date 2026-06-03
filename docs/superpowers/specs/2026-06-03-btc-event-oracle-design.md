# BTC Event Oracle — Design Spec

- **Date:** 2026-06-03
- **Status:** Approved design (pre-implementation)
- **Project root:** `C:\Users\GamerTech\btc-oracle`
- **Deploy target:** cPanel shared hosting → `vadym.online`
- **One-line:** An hourly-refreshed, honest Bitcoin forecasting site whose value is *transparency and a public accuracy scorecard* — a quant baseline that Claude nudges based on world events, held accountable against a random-walk benchmark.

---

## 1. Purpose & honest framing

A **personal / portfolio** website that publishes a *rolling* Bitcoin price forecast at three horizons — **1 week, 1 month, 1 year** — and, crucially, **tracks its own accuracy over time** against a naive benchmark.

The honest thesis, baked into the product from day one:

> Nobody can reliably predict Bitcoin's price from world events. At short horizons BTC is *near-random-walk* (weak-form efficient), so we should **expect** the model to roughly tie a "no change" baseline. The product's value is not a crystal ball — it is **transparency** (every forecast shows its reasoning and the events that drove it) and **accountability** (every forecast matures and is scored honestly, including when it fails to beat random walk).

Every number on the site is shown **with its uncertainty**. There are no bare buy/sell signals, no "guaranteed" or "will reach" language. A persistent disclaimer frames the whole site as educational (see §11).

---

## 2. Product overview

- **Three horizon forecasts**, each containing:
  - a **central price estimate** (the honest 50th-percentile median),
  - a **price range** (low–high) at a stated confidence level (e.g. 60%),
  - a **directional probability** `P(up)` ("58% chance higher in 1 week"),
  - a **confidence label** (Low / Medium / High),
  - a short **rationale** and the **events** that drove any adjustment.
- **Hourly refresh** via real cPanel cron (fires on time, indefinitely).
- **Command-dashboard** front-end (Layout A) on `vadym.online`: live ticker + all three horizons side-by-side + a forecast-vs-actual chart + the accuracy scorecard + "why it moved".
- **Accountability scorecard**: per-horizon hit-rate, error, and calibration vs a random-walk baseline. Publishing an honest "we barely beat random walk at 1 week" *is* the credible result.

---

## 3. Scope & sequencing (Approach B — lean MVP, then layer rigor)

The end-state architecture is identical in both phases; this is purely *what ships in v1*. The schema and engine interfaces are designed up front so Phase 2 slots in **without rework**.

### Phase 1 — MVP (the full honest loop, simplest form)
- Price ingest (Coinbase via `ccxt`, Kraken fallback) + history backfill.
- **EWMA volatility** baseline (λ = 0.94) → range + `P(up)`.
- Free event ingest: **GDELT**, **Crypto Fear & Greed**, **Bybit funding/OI**, **CoinDesk news**.
- **Claude Sonnet** bounded overlay (clamped drift/vol nudge, fallback to baseline on failure).
- Hourly orchestration on **cPanel cron**, writing to **SQLite** + emitting static JSON snapshots.
- Resolution + scoring: **Brier**, **MAPE**, **interval coverage**, all vs **random-walk**.
- Static-exported **Next.js** dashboard (Layout A, Recharts) on `vadym.online`.
- Disclaimer + honest-framing UI.

### Phase 2 — Layer rigor (no rework)
- Swap EWMA → **GARCH(1,1) / GJR-GARCH (Student-t)** via `arch`, with **Monte-Carlo simulation** for the 1m/1y ranges.
- Add proper scoring: **CRPS**, **pinball/quantile loss**, **PIT histogram**, **calibration / reliability diagrams**, **Diebold–Mariano** significance with **HAC/Newey–West** variance.
- Optional **marketaux** ($29/mo) richer pre-scored news.
- Optional daily-cadence context add-ons: BTC **spot-ETF flows** (Farside), **macro calendar** (FOMC/CPI).

---

## 4. Architecture (cPanel-native)

```
cPanel cron (hourly, real)  ──►  Python engine  (run_hourly.py)
        │  secrets from gitignored .env (Anthropic key, source-of-truth path)
        │
        │   1. pull BTC spot + recent OHLCV     (ccxt: Coinbase → Kraken; CoinGecko spot cross-check)
        │   2. update price_history, estimate volatility
        │   3. compute quant baseline: central / range / P(up) for 1w,1m,1y
        │   4. pull free event signals          (GDELT, Fear&Greed, Bybit funding, CoinDesk)
        │   5. condense → Claude Sonnet → bounded JSON nudge (clamped, audited)
        │   6. write runs + forecasts + events rows
        │   7. resolve any matured forecasts → scores
        │   8. emit static snapshots → public_html/data/{latest,history,scores}.json
        │
        ├─►  SQLite (source of truth)
        └─►  public_html/data/*.json (read cache for the browser)
                                   │
public_html (vadym.online)  ◄──────┘
   static-exported Next.js dashboard (Recharts)  ──fetch──►  /data/*.json
   No live DB connection from the browser → fast, cacheable, nothing to exploit.
```

**Why this shape:** real cron beats GitHub Actions' best-effort/auto-disabling cron; one host on the user's own domain; `$0` infra beyond existing hosting; the browser never touches the DB, so the public surface is just static files.

### Component boundaries (each independently testable)
- `prices/` — fetch spot + OHLCV, backfill, persist `price_history`. Depends on: `ccxt`, `httpx`. Pure data in/out.
- `baseline/` — given a return series + horizon, produce `{central, lower, upper, p_up, sigma_h, ...}`. Pure math; no network. **The most heavily unit-tested module.**
- `events/` — fetch + condense each source into normalized `event` rows + a compact LLM-facing bulleted summary. One adapter per source behind a common interface.
- `overlay/` — build the Claude prompt, call the API, validate + **clamp** the JSON nudge, apply it to the baseline, fall back on failure. Pure given a mocked client.
- `store/` — SQLite schema + typed read/write helpers. Single writer.
- `scoring/` — given matured forecasts + realized prices, compute metrics vs random walk. Pure math.
- `snapshots/` — render the DB into the three static JSON files the frontend reads.
- `run_hourly.py` — the orchestrator that wires the above in order; the only thing cron calls.
- `web/` — Next.js app (static export); reads only `/data/*.json`.

---

## 5. Data sources

### Price (the quant leg)
| Role | Source | Access | Notes |
|---|---|---|---|
| Primary historical OHLCV | **Coinbase** (`BTC-USD`) via **ccxt** | Free, no key, US-legal | Selectable granularities; paginate the 300-candle cap; history to ~2015. |
| Fallback historical OHLCV | **Kraken** via **ccxt** | Free, no auth | One-line swap; deep CSV dumps for one-time backfill. |
| Live spot (engine + ticker) | **CoinGecko** `/simple/price` (free Demo key) | $0, ~10k/mo, **CORS-enabled** | Browser ticker can call it directly; Coinbase spot is the fallback. |

Rejected: **Binance** (HTTP 451 US geoblock — avoid on the critical path), **CoinMarketCap** (no historical on free tier). Cross-check Coinbase vs CoinGecko spot at ingest to catch a stuck feed.

### Events — free starter set (Phase 1)
| # | Source | Access | Cadence | Signal to the LLM |
|---|---|---|---|---|
| 1 | **GDELT DOC 2.0** | Free, no key | Hourly | News tone + volume timelines for `(bitcoin OR "BTC")` and macro themes (FOMC, CPI, SEC). Send a User-Agent; back off on 429. |
| 2 | **Crypto Fear & Greed** (alternative.me) | Free, no key | Daily (cache) | 0–100 gauge + label + delta (contrarian context). |
| 3 | **Bybit** funding / OI (`v5/market`) | Free, no key | Hourly | Funding rate + open interest — short-term leverage/direction. (Bybit, **not** Binance, to dodge the geoblock.) |
| 4 | **CoinDesk / CCData news** | Free key (~250k **lifetime** calls) | Hourly | Crypto headlines with pre-computed POS/NEG/NEUTRAL sentiment + tags. |

**Cadence discipline:** hourly ingest only for fast signals; daily-cache the slow ones (Fear & Greed, later ETF flows / macro calendar). Store every raw pull (timestamped) for later backtesting.

Phase 2 paid option: **marketaux** ($29/mo) for per-entity pre-scored Bitcoin headlines.

---

## 6. The forecasting engine

**Division of labor (the honesty core):** the **quant baseline owns volatility and the band**; **Claude owns only a small, bounded, event-driven drift/skew nudge.** The bands — not the point estimate — carry the information.

### 6a. Quant baseline (formulas)
Work in **log returns** `r_t = ln(P_t / P_{t-1})`. Over horizon `h` days, `r_h ~ (μ_h, σ_h²)`:

```
μ_h = μ_daily · h
σ_h = σ_daily · √h
central = P0 · exp(μ_h)                      # report the MEDIAN, not lognormal mean
lower   = P0 · exp(μ_h − z · σ_h)            # asymmetric in price space (more upside room)
upper   = P0 · exp(μ_h + z · σ_h)
z       = t.ppf((1+c)/2, ν)                  # Student-t quantile (BTC is fat-tailed); MVP may use Normal z
P(up)   = Φ(μ_h / σ_h) = Φ(μ_daily · √h / σ_daily)
```

- **Drift `μ_daily` = 0** (efficient-market null) for MVP. *Never* extrapolate trailing bull-market drift (its standard error is enormous). **Frozen default; disclosed.**
- **Volatility:**
  - **MVP:** **EWMA (λ = 0.94, RiskMetrics)** on daily log returns. Reactive, no fitting, installs cleanly on shared hosting (numpy/pandas only). **Frozen and disclosed.**
  - **Phase 2:** **GARCH(1,1)/GJR-t** via `arch`; for 1m/1y use `forecast(method='simulation', simulations=10000)` and read `central=median`, band=`np.quantile`, `P(up)=mean(prices>P0)` empirically. Total multi-day variance = **sum** of daily forecast variances (common bug if you use only the last day).
- **1-year is explicitly Low confidence:** σ_year ≈ 19× σ_daily; widen rather than narrow, keep drift minimal, and label it Low in the UI.

Baseline emits per horizon: `{mu_h, sigma_h, central, lower, upper, p_up, nu, vol_model, vol_window}`.

### 6b. The Claude overlay (bounded, auditable)
**What Claude sees:** the baseline object for all three horizons + 6–12 pre-digested event bullets `{signal, value, delta vs baseline, plain-language interpretation}` (deltas/z-scores computed in Python so the LLM interprets, not crunches). Static system prompt uses **prompt caching**.

**What Claude returns** (strict JSON, validated before write):
```json
{ "horizons": {
    "1w": {"drift_adj_bps": 35, "vol_mult": 1.10, "skew_adj": -0.05, "p_up_override": null, "confidence": "medium"},
    "1m": {"drift_adj_bps": 80, "vol_mult": 1.05, "skew_adj":  0.00, "p_up_override": null, "confidence": "medium"},
    "1y": {"drift_adj_bps":  0, "vol_mult": 1.00, "skew_adj":  0.00, "p_up_override": null, "confidence": "low"} },
  "rationale": "Funding crowded-long + imminent FOMC → widen 1w band, mild downside skew…",
  "event_refs": ["evt_8842", "evt_8847"] }
```

**Bounding (the guardrail) — apply, then clamp before computing final numbers (starting values, tunable):**
- `drift_adj` clamp: **±50 bps (1w)**, **±150 bps (1m)**, **±100 bps (1y)** on `μ_h` (long-horizon drift gets the tightest leash).
- `vol_mult` clamp: **[0.8, 1.5]** (can widen for event risk, never collapse the band).
- Resulting **`P(up)` hard-clamped to [0.30, 0.70]**; `p_up_override` ignored unless inside bounds.
- **Failure handling:** LLM call fails / times out / returns invalid JSON → **use the raw baseline**, set `llm_applied = false`. One noisy news day can never blow up a forecast.
- The nudge is stored as an explicit **delta** on top of `baseline_*` columns → every intervention is auditable.

### 6c. Forecast output object
Stored per `(run, horizon)` — see schema §8. Stores **both** quantiles (model-agnostic scoring) **and** `mu_h/sigma_h/nu` (closed-form CRPS), plus the pre-LLM `baseline_*` values for the audit delta, plus reproducibility fields (`model_id`, `engine_version`, `prompt_version`).

---

## 7. Scoring & track record

**Per horizon, never blended** (different problems, different sample counts). Every metric is reported **against a random-walk "no change" baseline** (`μ_ref = spot at issue`).

| Quantity | MVP metric | Phase 2 add | Baseline to beat |
|---|---|---|---|
| Direction `P(up)` | **Brier** `(p−y)²` | Brier decomposition, **BSS** | p=0.5 random walk |
| Central point | **MAPE / MAE** | RMSE, **Theil's U2** | RW no-change (MASE-style ratio) |
| Interval | **coverage @ stated level** | **CRPS**, **pinball loss** | CRPS vs RW |
| Calibration | (basic coverage table) | **reliability diagram**, **PIT histogram**, coverage curve | — |
| Significance | (report N + caveat) | **Diebold–Mariano** w/ HAC + Harvey correction, block-bootstrap CIs | — |

**Honest expectations:** at 1w/1m, BSS ≈ 0 and MAE ratio ≈ 1 — that's the *credible* result, reported plainly ("cannot reject equal accuracy vs random walk"). **1-year is marked "insufficient data" until enough forecasts resolve.** Metric and label definitions are **frozen and versioned** before launch; history is never silently recomputed.

**Dashboard charts:** forecast band (Area + central Line) vs actual; `P(up)` over time; lifetime scorecard table (`horizon | N | Brier | Brier_base | MAPE | MAPE_rw | cover@60`); Phase 2 adds reliability diagram, coverage curve, PIT histogram, rolling-window metrics.

---

## 8. Data model (SQLite)

SQLite is the source of truth (single hourly writer → robust, zero-config). UUIDs as text; timestamps as ISO-8601 text (UTC); booleans as `INTEGER 0/1`; prices/metrics as `REAL`; raw payloads as JSON `TEXT`.

```sql
-- One hourly run
CREATE TABLE runs (
  run_id         TEXT PRIMARY KEY,           -- uuid4 hex
  run_at         TEXT NOT NULL,              -- ACTUAL run time (cron drifts), ISO-8601 UTC
  spot_at_issue  REAL NOT NULL,              -- P0; also the random-walk baseline
  spot_source    TEXT,                       -- coinbase | coingecko | kraken
  engine_version TEXT, prompt_version TEXT, model_id TEXT,
  llm_applied    INTEGER DEFAULT 0
);

-- One row per (run, horizon) — the core forecast object
CREATE TABLE forecasts (
  forecast_id   TEXT PRIMARY KEY,
  run_id        TEXT REFERENCES runs(run_id),
  horizon       TEXT NOT NULL,               -- '1w' | '1m' | '1y'
  target_at     TEXT NOT NULL,               -- maturity, ISO-8601 UTC
  central       REAL NOT NULL,
  lower REAL, upper REAL, conf_level REAL,    -- e.g. 0.60
  q05 REAL, q25 REAL, q50 REAL, q75 REAL, q95 REAL,
  mu_h REAL, sigma_h REAL, nu REAL,
  p_up          REAL NOT NULL,
  confidence_label TEXT, band_width_pct REAL,
  baseline_central REAL, baseline_p_up REAL, baseline_sigma_h REAL,  -- pre-LLM (audit delta)
  vol_model TEXT, vol_window INTEGER, drift_mode TEXT,
  drift_adj_bps REAL, vol_mult REAL, skew_adj REAL,                  -- bounded overlay applied
  rationale TEXT,
  resolved INTEGER DEFAULT 0,
  UNIQUE (run_id, horizon)
);

-- Condensed event signals shown to the LLM (auditable)
CREATE TABLE events (
  event_id    TEXT PRIMARY KEY,
  observed_at TEXT NOT NULL,
  source      TEXT,                          -- gdelt | funding | fng | news | macro | etf
  signal TEXT, value REAL, delta REAL,
  interpretation TEXT, headline TEXT, url TEXT, sentiment TEXT,
  raw TEXT                                   -- JSON
);
CREATE TABLE forecast_events (
  forecast_id TEXT REFERENCES forecasts(forecast_id),
  event_id    TEXT REFERENCES events(event_id),
  PRIMARY KEY (forecast_id, event_id)
);

-- Matured scores (computed at resolution; dashboard reads precomputed rows)
CREATE TABLE scores (
  forecast_id    TEXT REFERENCES forecasts(forecast_id),
  horizon        TEXT, resolved_at TEXT,
  realized_price REAL, up_outcome INTEGER,   -- 1=up else 0 (frozen rule: realized > spot_at_issue)
  brier REAL, brier_base REAL, bss REAL,
  crps REAL, crps_rw REAL,
  ae REAL, ape REAL, mae_ratio REAL, theil_u2 REAL,
  pit REAL, covered INTEGER,                 -- covered at the forecast's conf_level
  PRIMARY KEY (forecast_id)
);

-- Append-only price history for vol estimation + RW baseline + scoring
CREATE TABLE price_history (
  ts REAL, source TEXT, interval TEXT,       -- '1d' | '1h' ; ts = epoch seconds
  open REAL, high REAL, low REAL, close REAL, volume REAL,
  PRIMARY KEY (source, interval, ts)
);
```

Retention: hourly × 3 horizons ≈ 26k forecast rows/yr — trivial for SQLite; no purge needed for years.

---

## 9. Dashboard (Layout A — command dashboard)

Single-screen, dense "fintech terminal" feel, on `vadym.online`. Static-exported Next.js + Recharts; reads only `/data/{latest,history,scores}.json`.

- **Header / ticker:** live BTC spot (CoinGecko, client-side) + prominent **"as of <run_at>"** stamp + one-line honest purpose statement.
- **Three horizon cards (1W / 1M / 1Y) side-by-side:** central price, low–high band, `P(up)` %, confidence chip. Uncertainty is never hidden — no bare arrows.
- **Forecast chart:** historical central + band (Recharts `<Area>` + `<Line>`) overlaid with realized actual price.
- **Accuracy scorecard:** per-horizon table vs random walk (+ Phase 2 calibration/reliability/PIT/rolling charts). 1Y shows "insufficient data" until it resolves enough.
- **"Why it moved":** latest rationale + the event bullets Claude saw (with sources).
- **Persistent footer disclaimer** linking to `/disclaimer`.

Data freshness: snapshots regenerate each hourly run; the static host serves them with short cache headers.

---

## 10. Deployment & ops (cPanel)

- **Python engine:** cPanel "Setup Python App" (Passenger) or a plain virtualenv; MVP deps are shared-hosting-friendly (`ccxt`, `httpx`, `numpy`, `pandas`, `anthropic`). Phase 2's `arch`/`scipy` install is a **flagged verification step** (manylinux wheels usually fine).
- **Cron:** a single hourly cPanel cron entry → `python run_hourly.py`. Record the **actual** `run_at` (cron drifts a few minutes); never assume `:00`.
- **Frontend:** `next build` with `output: 'export'` → static files copied into `public_html`; the engine writes `public_html/data/*.json`.
- **Secrets:** Anthropic API key (and any future keys) in a **gitignored `.env`** loaded by the engine, or cPanel env — **never in code, never committed, never in memory.**
- **Repo:** public GitHub (unlimited Actions if ever needed; portfolio-visible). `.gitignore` covers `.env`, `*.db`/`*.sqlite`, `node_modules/`, `.next/`, `out/`, generated `data/*.json`, `__pycache__/`, `.superpowers/`.
- **🔐 Action item:** rotate the cPanel password (it was shared in chat) once deployed; same for any API key shared in plaintext.

---

## 11. Honest framing & disclaimer

- Position as an **educational portfolio project that tracks a forecasting method's accuracy**, not advice. One-line purpose statement in the hero so the whole site reads descriptive, not prescriptive.
- **Always show uncertainty:** central + band, direction as explicit `P(up)` %, Low/Med/High confidence. The scorecard ("we barely beat random walk at 1w") is the strongest honesty signal.
- **Disclose method + LLM limits:** quant baseline adjusted by Claude using world events; LLMs are non-deterministic, have a knowledge cutoff, and no special knowledge of future prices; hourly refreshes can swing on noise.
- **Scrub copy** of red-flag terms: never "guaranteed", "risk-free", "sure thing", "profit", "will reach", or buy/sell CTAs. Prefer "estimates", "model-implied probability", "suggests".
- **Persistent footer disclaimer** + a fuller `/disclaimer` page. Stay purely informational (no funds, portfolios, or personalized recommendations) to remain clearly outside broker/adviser activity. Not legal advice; get a lawyer if it ever monetizes.

**Sample line:**
> *Educational/portfolio project — not financial advice, not from a registered broker or adviser. These are model-implied probabilities and ranges, not guarantees; past and backtested performance does not predict future results. Bitcoin is highly volatile and you can lose your entire investment. Use at your own risk and consult a licensed professional.*

---

## 12. Testing strategy

- **Unit (pure modules):** `baseline` math (range monotonic in σ, `P(up)→0.5` as μ→0, √-time scaling); `overlay` clamps (out-of-bounds nudges are bounded; invalid JSON → baseline fallback with `llm_applied=false`); `scoring` (Brier/MAPE/coverage on known fixtures; RW baseline correct).
- **Adapter tests:** each event/price source behind its interface, with recorded fixtures (no live network in CI).
- **Integration:** end-to-end `run_hourly` against a temp SQLite + mocked Claude + recorded source fixtures → asserts rows written and snapshots emitted.
- **Resolution test:** a forecast whose `target_at` has passed is scored correctly against `price_history`.
- **Frontend:** snapshot/contract test that the dashboard renders from a known `/data/*.json` fixture.
- TDD per the team workflow: tests precede implementation for the math-heavy modules especially.

---

## 13. Build plan (phased milestones)

1. **Foundations:** repo + `.gitignore` + project layout; SQLite schema + `store`; price ingest + history backfill.
2. **Baseline engine (TDD):** EWMA vol → range + `P(up)`; baseline output object.
3. **Events + overlay:** the four free adapters + condenser; Claude Sonnet bounded overlay + clamps + fallback.
4. **Orchestration + storage:** `run_hourly.py`; cPanel cron; snapshot emitter.
5. **Resolution + scoring:** maturity detection; Brier/MAPE/coverage vs RW.
6. **Dashboard (Layout A):** static-exported Next.js + Recharts reading `/data/*.json`; disclaimer + `/disclaimer`.
7. **Deploy:** push static + engine to cPanel; verify a live hourly run end-to-end; rotate secrets.
8. **Phase 2 (later):** GARCH/sim, CRPS/DM/calibration, marketaux, ETF/macro context.

---

## 14. Open decisions — resolved defaults (frozen + disclosed)

| # | Decision | Chosen default |
|---|---|---|
| 1 | Binance geoblock | Use **Bybit** for funding/OI from the start. |
| 2 | Repo visibility | **Public** GitHub. |
| 3 | Volatility window | MVP **EWMA λ=0.94**; revisit window via backtest coverage in Phase 2. |
| 4 | Directional label | `up_outcome = 1 if realized > spot_at_issue else 0` (strict). Frozen before any Brier is computed. |
| 5 | Drift mode | `μ_daily = 0` (efficient-market null). |
| 6 | Overlay clamps | ±50/150/100 bps drift; `vol_mult ∈ [0.8,1.5]`; `P(up) ∈ [0.30,0.70]`. Starting values, tunable. |
| 7 | CoinDesk lifetime cap | ~250k lifetime calls; at ~720/mo lasts years — verify key dashboard, fine for MVP. |
| 8 | Overlapping-forecast significance | MVP reports raw metrics + N + overlap caveat; **no significance claims** until Phase 2 (DM + HAC). |
| 9 | Monetization | **None** — keeps the educational/non-commercial framing clean. |
| 10 | Retention | Keep full hourly history (trivial for SQLite); revisit only if size ever matters. |

---

## 15. Out of scope (YAGNI)

Multi-coin support; user accounts/auth; email/Telegram alerts; live trading or portfolio tracking; paid news API (Phase 2 optional); GARCH/CRPS/DM (Phase 2); any monetization, affiliate, or referral links.

# BTC Event Oracle — project context (read me first)

> If you're a Claude Code session opened in this directory: this file is the source of truth for
> what this project is and how to work on it. Host/credential specifics that can't be public are in
> **`deploy/notes.local.md`** (gitignored — read it for cPanel/GitHub specifics).

## What this is
An **honest, hourly Bitcoin price forecast** website. Every hour a Python engine reads world-event
signals (crypto Fear & Greed, perp funding, open interest, news tone) + a quant baseline, has
**Claude (Sonnet)** apply a small *bounded* adjustment, and publishes a forecast for **1 week / 1
month / 1 year** — each as a price range + directional probability + confidence. It tracks its own
accuracy over time against a **random-walk benchmark**.

**Honest-framing rule (do NOT violate):** never imply guarantees or give buy/sell advice. Short-horizon
BTC is near-random-walk, so the model is *expected* to roughly tie "no change." The product's value is
transparency + the public accuracy scorecard. Always show uncertainty. It's labeled "not financial
advice" and has a `/guide` (plain-English explainer) and `/disclaimer` page.

## Live URLs
- Dashboard: **https://vadym.online/btc**  ·  Guide: **/btc/guide**  ·  Disclaimer: **/btc/disclaimer**
- Code (public): **https://github.com/thisoldhatz/btc-event-oracle**

## Architecture
```
GitHub Actions (hourly cron, .github/workflows/hourly.yml)
   └─ runs the Python engine (Claude API) → SQLite → writes latest/history/scores/extras.json
      └─ SFTP-pushes the JSON to the cPanel host: public_html/btc/data/
         └─ static Next.js dashboard (public_html/btc/) fetches /btc/data/*.json client-side
   └─ persists the SQLite forecast-history db on a single-commit 'state' branch
```
- **Engine** = Python package `btc_oracle` under `src/`. Hybrid: quant baseline = **GJR-GARCH** conditional
  volatility (`garch.py`, mean-reverting multi-day term structure) with **EWMA fallback** (`returns.py`),
  **regime detection** that widens intervals in turbulence (`regime.py`), lognormal range + P(up). Claude
  nudges within hard clamps (drift ±50/150/100 bps, vol_mult [0.8,1.5], P(up) [0.30,0.70]); **fully
  fail-soft**. Signals (`events/`): Fear&Greed, OKX funding+OI, Deribit DVOL, GDELT tone, RSS news.
  Scoring (`scoring.py`/`resolve.py`): Brier+decomposition, **CRPS/CRPSS**, coverage, overlay-vs-baseline
  A/B, rolling windows — all vs random walk. Also fetches a **Polymarket** markets feed. Entry: `python -m btc_oracle.cli run`.
- **Dashboard** = Next.js 14 app in `web/` (App Router, TypeScript, Tailwind, Recharts), static-exported
  with `basePath: '/btc'`. Signals strip (+Fear&Greed dial, implied-vol), GARCH forecast cards with
  countdowns, forecast-vs-actual chart, "why it moved", accuracy scorecard + **calibration/skill panel**,
  **markets panel**, **"your call vs the model"** game, "did it call it" reveals, "changed its mind"
  timeline, RSS news feed, ticking price, 60s auto-refresh. Pages: `/`, `/guide`, `/about`, `/disclaimer`.

## Repo layout
- `src/btc_oracle/` — engine: `cli.py` (commands), `baseline.py`, `returns.py` (EWMA vol),
  `overlay.py` (Claude clamp/apply/fallback), `llm.py` (Claude client), `store.py` (SQLite),
  `prices.py` (ccxt/CoinGecko), `resolve.py` + `scoring.py` (grade matured forecasts vs random walk),
  `snapshots.py` (emit JSON), `run_hourly.py` (orchestrator), `events/` (adapters).
- `web/` — the dashboard. `lib/` (typed data/format/hooks), `components/`, `app/`.
- `tests/` — pytest (~130 tests). `web/**/*.test.tsx` — vitest (~52 tests).
- `deploy/` — `sftp_upload.py` (deploy), `ssh_recon.py`, `README.md`, `notes.local.md` (gitignored).
- `docs/superpowers/specs|plans/` — the full design spec + every implementation plan (good history).
- `.github/workflows/hourly.yml` — the hourly engine + push.

## Dev workflow (Windows; bash = git-bash, paths like /c/Users/...)
```bash
# Python engine
python -m venv .venv && ./.venv/Scripts/python -m pip install -r requirements.txt && ./.venv/Scripts/python -m pip install -e .
./.venv/Scripts/python -m pytest -q                 # run tests (must stay green)
./.venv/Scripts/python -m btc_oracle.cli run        # full hourly cycle locally (writes ./public_html/data)
./.venv/Scripts/python -m btc_oracle.cli preview     # event-aware forecast, no persistence

# Dashboard (in web/)
cd web && npm install
npm test                                            # vitest
npm run build                                        # static export -> web/out/  (basePath /btc)
python -m http.server 8080 --directory out           # local preview at localhost:8080/btc... (serve from repo root w/o basePath: serve web/out at /)
```

## Deploy (how to ship a change)
- **Engine/logic change:** just commit + push to `main`. GitHub Actions picks it up on the next hourly
  run (or trigger now: `gh workflow run hourly.yml --ref main`).
- **Dashboard change:** `cd web && npm run build`, then from repo root, with SFTP creds in env (see
  `deploy/notes.local.md`): `python deploy/sftp_upload.py web/out public_html/btc`. Then refresh data
  into the export if needed (`cp public_html/data/*.json web/out/data` after a local engine run).
- **Secrets** live ONLY in GitHub repo secrets (`ANTHROPIC_API_KEY`, `SFTP_HOST/PORT/USER/PASS`) and
  the local environment — never in the repo.

## Gotchas / decisions (important)
- **cPanel shell is DISABLED** on the host (auth works on SSH port 21098 but no command exec).
  **SFTP + FTPS uploads DO work.** That's why the engine runs on GitHub Actions, not on the host.
- **Use OKX for funding/open-interest, NOT Bybit** — Bybit blocks data-center IPs, so on GitHub
  runners only Fear & Greed showed up. OKX's public API is cloud-friendly. (`events/okx.py`.)
- GDELT (news tone) frequently rate-limits (429) → fail-soft, sometimes absent. Expected.
- The dashboard is at **/btc** → `next.config.mjs` sets `basePath:'/btc'` and `lib/data.ts` prefixes
  fetches with `NEXT_PUBLIC_BASE_PATH`. If you ever move it, change both.
- The forecast-history SQLite db is restored/saved on the `state` branch each Actions run (keeps `main`
  clean + the repo active so the scheduled workflow isn't auto-disabled).
- The Anthropic API key is already present in the dev machine's environment (engine runs Claude live).
- ANTHROPIC model id: `claude-sonnet-4-6` (in `llm.py`). Prompt caching is on.

## Status & known limitations (as of 2026-06-03)
- LIVE and self-updating hourly. ~130 Python + ~52 web tests green. Homepage at `vadym.online` root.
- **Shipped beyond the original MVP** (improvement roadmap in `docs/IMPROVEMENT-ROADMAP.md`):
  Phase A reliability (multi-source price failover, keep-alive workflow, healthcheck hook, db artifact
  backup, stale banner); Phase B methodology (GJR-GARCH, regime, Deribit DVOL); Phase C scoring
  (CRPS/CRPSS, Brier decomposition, rolling windows, overlay-vs-baseline A/B, Polymarket feed);
  Phase D dashboard (markets/skill panels, your-call game, About page) + homepage.
- Scorecard/skill/"did it call it" panels show "insufficient data" because the track record is brand new
  — they fill in as forecasts mature (1-year stays "insufficient" for ~a year, by design).
- **Still open / TODO:** rotate the cPanel password (was shared in chat) then update the `SFTP_PASS`
  GitHub secret; optional `HC_PING_URL` healthchecks.io secret; SSL cert expires **2026-12-18**.
  Roadmap items NOT yet built: HAR intraday-realized-variance vol, multi-asset (ETH/SOL), engine-rendered
  OG share images + RSS feed, a Telegram channel.

## Process note
Built with the `superpowers` skill workflow (brainstorm → spec → plan → subagent-driven TDD), then
extended via a research-backed roadmap. The specs/plans in `docs/superpowers/` and `docs/IMPROVEMENT-ROADMAP.md`
document every decision — the best place to understand *why* things are the way they are.

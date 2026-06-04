# STATUS — BTC Event Oracle (resume-here snapshot)

_Last updated: 2026-06-04. For full reference see **CLAUDE.md** (auto-loads in a Claude Code session here).
Plans: **docs/IMPROVEMENT-ROADMAP.md** (research), **docs/NEXT-IMPROVEMENTS.md** (code-grounded audit),
**docs/REDESIGN-SPEC.md** (the editorial redesign), **docs/MONEY-AND-GROWTH-PLAN.md**, **docs/CLOUDFLARE-MIGRATION.md**._

## ⚠️ 2026-06-04 session — committed locally, NOT yet pushed/deployed
Seven commits are on local `main` but **not pushed** (a safety gate blocks Claude from pushing to a
production-deploying branch). **To ship everything: `git push origin main`** — the hourly workflow
deploys the engine changes and `deploy-web.yml` builds+SFTPs the redesigned dashboard. What's in them:
- **Firewall fix** (`35066d0`): the dashboard's 60s/4-file cache-busted polling tripped the host firewall
  into IP-banning visitors (the `Unexpected token '<'` error). Now 5-min polling, pause-when-hidden,
  backoff, latest-only fetch + a friendly block message. Added `deploy-web.yml`.
- **Bundle A data-integrity** (`2603c08`): partial-candle upsert (was freezing the day's close → poisoned
  vol + scoring), spot sanity bounds, backfill guard, GJR-GARCH persistence guard (no more blown-out 1y
  band), durable-db-before-SFTP, BSS/CRPSS falsy-guard, skip empty runs, order windows by target_at.
- **Calibration emit + OKX fix** (`962cebd`): engine now emits per-bin reliability + a real PIT histogram
  + uniformity stat; OKX funding `observed_at` fixed (was a future timestamp).
- **Editorial "Ledger" redesign** (`f7ec972`,`08fccb5`): full dark editorial-data-viz redesign — sticky
  Masthead + 4 Acts; ProbabilityFan hero (band > number); range-first triptych; ForecastChart with a
  random-walk reference line; **reliability diagram + PIT histogram charts**; model-vs-Polymarket
  dumbbell; zero-axis skill bars surfacing the CRPS verdict; accessible InfoDots; Fraunces/Inter/Plex
  Mono. (Replaced HorizonCard.)
- **Signal staleness** (`f4…`): a "stale Xh" marker per signal past its freshness budget.
- **Tests/build:** 139 pytest + 54 vitest green; `npm run build` green.
- **Deferred (in docs/NEXT-IMPROVEMENTS.md):** Polymarket head-to-head *resolution scoring* (the dumbbell
  shows live quotes now; full Brier-vs-market fills in once markets resolve), a Diebold-Mariano
  significance test, funding/OI delta, skew_adj removal, an optional wider 80/90% band.

## Resume in 30 seconds
- **The site is LIVE and self-updating hourly** — nothing is broken, nothing is mid-flight, all tests pass.
- **https://vadym.online/btc** (dashboard) · **vadym.online** (homepage) · repo **github.com/thisoldhatz/btc-event-oracle** (`main`).
- The Python engine runs **hourly on GitHub Actions**, writes JSON/PNG/RSS, and SFTP-pushes them to the cPanel host. The dashboard is a static Next.js export already deployed to `public_html/btc/`.
- To work on it: open Claude Code **in this folder** (`C:\Users\GamerTech\btc-oracle`) so `CLAUDE.md` loads, then say what you want. Host/credential specifics are in the gitignored `deploy/notes.local.md`.

## ✅ What's done (complete + live)
- **MVP**: hybrid quant + bounded Claude overlay, SQLite, hourly snapshots, full Next.js dashboard, guide + disclaimer pages.
- **Reliability**: multi-source price failover, keep-alive workflow (beats the 60-day auto-disable), healthcheck hook, db artifact backup, stale-data banner.
- **Methodology**: GJR-GARCH volatility (EWMA fallback) + regime detection (widens intervals in turbulence) + Deribit DVOL signal.
- **Scoring**: CRPS/CRPSS, Brier decomposition, coverage, rolling windows + N + CIs, overlay-vs-baseline A/B, Polymarket "markets imply" feed — all vs random walk.
- **Dashboard/content**: signals strip + Fear&Greed dial, GARCH forecast cards + countdowns, forecast-vs-actual chart, "why it moved", accuracy scorecard + calibration/skill panel, markets panel, "your call vs the model" game, "did it call it" reveals, "changed its mind" timeline, news feed; About/Method page; homepage at the domain root.
- **Shareability**: engine-rendered OG card (`/btc/data/og.png`) + RSS feed (`/btc/data/rss.xml`).
- **Tests**: ~130 Python (pytest) + ~52 web (vitest), all green.

## 🔧 Open actions FOR THE USER (do these when convenient)
1. **Rotate the cPanel password** (it was shared in chat) → then tell Claude to update the GitHub secret `SFTP_PASS` (`gh secret set SFTP_PASS`).
2. **(optional) healthchecks.io**: free signup → create a check (90-min grace) → give Claude the ping URL → it sets the `HC_PING_URL` GitHub secret (the workflow already uses it, skips until set).
3. **SSL cert expires 2026-12-18** (manually issued, won't auto-renew) — renew/replace in cPanel before then, or switch the domain to AutoSSL.

## 📋 What to do next (deferred — pick any; each is a sizeable standalone effort)
Build these the same way: brainstorm/spec → plan in `docs/superpowers/plans/` → subagent-driven TDD workflow → verify → push (Actions deploys engine; SFTP for dashboard).
1. **Telegram channel** _(the user said "everything except the Telegram thing" — so confirm they want it first)_. Reuse the `polymarket_betting` bot patterns. Fire only on real events (direction flip / forecast resolution), honest framing, ride the hourly cadence (out-of-band "urgent" alerts would hurt both trust AND the legal publisher's-exclusion — see roadmap §7).
2. **HAR intraday realized-variance volatility** — research-verified to beat daily GARCH at short horizons, but needs an intraday BTC price feed + a realized-variance pipeline (heavier than the current daily engine). Sequence after the current GARCH baseline. Notes in `docs/IMPROVEMENT-ROADMAP.md` Tier 3 + the deep-research findings.
3. **Multi-asset (ETH/SOL)** — biggest content multiplier; parametrize the engine over an asset list (price source, signals, snapshot paths) + asset tabs on the dashboard.
4. **Smaller polish (data-dependent)**: full reliability-diagram / PIT-histogram charts on the calibration panel (the scalar metrics + PIT values are already computed — just need binned exposure + a chart) once forecasts mature; weekly email digest (Buttondown); register forecasts on Brier.fyi/Metaculus for third-party scoring.

## 🧭 How to work on it (cheat-sheet)
```bash
# Python engine (Windows; bash = git-bash)
./.venv/Scripts/python -m pytest -q                 # tests (keep green)
./.venv/Scripts/python -m btc_oracle.cli run         # one full hourly cycle locally
# Dashboard
cd web && npm test && npm run build                  # vitest + static export -> web/out/ (basePath /btc)
# Deploy a DASHBOARD change (engine changes just need: git push -> Actions runs hourly):
cd web && npm run build && cd ..
SSH_HOST=... SSH_PORT=21098 SSH_USER=... SSH_PASS='...' ./.venv/Scripts/python deploy/sftp_upload.py web/out public_html/btc
# Trigger an engine run now:  gh workflow run hourly.yml --ref main
```
**Key gotchas (full list in CLAUDE.md):** cPanel shell is DISABLED (engine runs on Actions, SFTP for files); use **OKX** not Bybit for funding/OI (Bybit blocks cloud IPs); dashboard lives at **/btc** (`basePath` in `next.config.mjs` + `NEXT_PUBLIC_BASE_PATH` in `lib/data.ts`); the forecast-history SQLite db lives on the **`state` branch**; **secrets** only in GitHub Actions secrets / env / host — never the repo. Built with the `superpowers` workflow; every decision is documented in `docs/superpowers/specs|plans/`.

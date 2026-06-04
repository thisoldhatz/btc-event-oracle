# Programmatic SEO + GEO — design (2026-06-04)

**Goal:** Turn the scored data the engine already produces into a set of statically-generated,
individually-rankable, **GEO-quotable** pages — the highest-leverage, self-contained distribution play
(no external accounts, no ongoing cost, fully honesty-aligned: we publish our own track record).

**Architecture:** Next.js **SSG** (same "Ledger" design system as the dashboard — one codebase, one
look). Pages render at build time from the engine's JSON (build-time fetch from the host, with a
committed fallback). `/accuracy` additionally client-refreshes live numbers. A **daily scheduled
rebuild** keeps recaps + the crawled accuracy claim current. Authorship = a **brand persona** (no
personal name); `Organization` schema with `sameAs` → the public GitHub repo is the E-E-A-T anchor.

## Pages
- **`/accuracy`** — the track record as a standalone page: per-horizon Brier/CRPS/coverage + the DM
  "beats the random walk?" verdict, led by a **dated, quotable claim** ("As of {as_of}, the 1-week
  directional Brier is {x} vs a random-walk {y}, over N={n} resolved forecasts"). SSG (crawlable) +
  client-refresh (live). `Dataset` JSON-LD.
- **`/methodology`** — how the engine works (GJR-GARCH + regime + bounded overlay + proper scoring),
  citable, with source links. `Article` JSON-LD.
- **`/signals/[name]`** — one explainer per signal (fear_greed, funding_rate, open_interest,
  implied_vol, news_tone): what it is, its recent history (series), and how it feeds the forecast.
  `generateStaticParams` from the engine's signal list. `Article` + `FAQPage` JSON-LD.
- **`/recap/[week]`** — a weekly recap (ISO week): what was forecast and how it resolved (hit rate,
  avg error, coverage, example calls). `generateStaticParams` from completed weeks. `Article` JSON-LD.
  Essentially immutable once the week completes.
- **`/who`** — brand-persona "who runs this": independent, non-commercial, open-source; anchors trust.

## Engine additions (Python, hourly — `snapshots.py` + `store.py`)
Emit one new file, **`seo.json`**, via `build_seo(conn)`:
- `as_of`: the latest run's `run_at` (for the dated claim).
- `signals`: per-signal recent series `[{observed_at, value, delta, interpretation}]` via a new
  `store.get_signal_history(conn, signal, limit)`.
- `recaps`: per-completed-ISO-week aggregates via `build_weekly_recaps(conn)` from `get_results` —
  `{week, n, hit_rate, avg_pct_err, coverage_rate, by_horizon, items[:N]}`.
`build_seo` is included in `write_snapshots`. `scores.json`/`extras.json` (already emitted) feed
`/accuracy`. All fail-soft; new tests cover `get_signal_history`, `build_weekly_recaps`, `build_seo`.

## Web foundation
- `lib/seo.ts` — build-time fetch of the engine JSON (scores/extras/seo) from
  `${NEXT_PUBLIC_DATA_ORIGIN}/btc/data/*.json` with a committed fallback sample so local/first builds
  never hard-fail; typed.
- `components/JsonLd.tsx` — renders `<script type="application/ld+json">` for the schemas.
- `app/sitemap.ts` + `app/robots.ts` — Next route handlers generating `sitemap.xml` (all static +
  generated paths) and `robots.txt` (allow + sitemap link). `basePath` '/btc' aware.
- Pages reuse the Ledger tokens/components (Section, tables, charts) for visual consistency.

## GEO discipline
Every key page leads with clean, **dated, named-claim** prose an LLM can lift verbatim; schema markup;
tight interlinking (dashboard → /accuracy & /methodology; signals strip → /signals/*; /accuracy →
recaps; footer/colophon nav to /who, /methodology, /accuracy).

## Ops
- `.github/workflows/seo-rebuild.yml` — a daily `schedule` cron that triggers `deploy-web` (rebuild),
  so new recap pages appear and the crawled accuracy claim stays fresh. ~1.5 min/day.

## Out of scope (this piece)
Per-individual-call pages (thin-content risk — held). The C+D internal "control room" (its own later
piece; a Cloudflare-Worker backend that holds the Bluesky/email connections and centralizes
stats/posting — connect-once, everything-internal). Bluesky/Nostr bots, the email digest.

## Testing
pytest: `get_signal_history`, `build_weekly_recaps` (ISO-week grouping + aggregates), `build_seo` shape.
vitest: a render smoke test for `/accuracy` and `/signals/[name]` against fixture data; `next build`
green (SSG enumerates signals/weeks).

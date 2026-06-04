# BTC Event Oracle — Improvement Roadmap (research-backed, 2026-06-03)

Synthesized from two research passes: (A) a deep-research harness with **adversarial 3-vote
verification** on peer-reviewed sources (methodology + signals — high confidence), and (B) a
supplementary single-pass cited sweep (scoring, engagement, growth, comparables, legal, reliability —
medium confidence, cited but not adversarially verified).

## The one strategic insight (free, and it ties everything together)

**Honesty-first is not just ethical — it is simultaneously the competitive moat, the legal shield, the
SEO advantage, and the only methodologically credible play.** Every research angle pointed the same way:

- **Methodology:** even a jump-diffusion + GJR-GARCH Monte Carlo gets only ~50% price MAPE and barely
  beats a coin flip on direction at 1h (arXiv 2405.12988). So **don't chase directional accuracy —
  invest in calibrated intervals + transparent scoring.**
- **Competitive gap:** CoinCodex / DigitalCoinPrice / aipredictsbitcoin publish unfalsifiable far-future
  point targets with **no track record**; Polymarket/Kalshi have rigorous Brier scoring but **no
  explanation of *why*.** The intersection — *calibration-first + explanation-rich + openly humble* — is
  **structurally vacant** (financefeeds.com, brier.fyi, coincodex.com).
- **Legal:** the *Lowe v. SEC* publisher's exclusion is strengthened by being disinterested/non-promotional;
  openly showing you tie a random walk is the *opposite* of promotional (Greenberg Traurig 2024).
- **SEO:** Google's YMYL/E-E-A-T bar rewards verifiable claims + track record + transparent methodology —
  exactly what competitors lack (ranktracker, outpaceseo).

→ **Lead with the scorecard and calibration. That's the product.**

---

## Tier 1 — Quick wins (high impact, low effort) — do these first

| # | Improvement | Why / evidence | Honesty |
|---|---|---|---|
| 1 | **Compare P(up) to Polymarket/Kalshi implied odds** — log their probability at issue, Brier-score both, show divergence | The single most credibility-building move; no competitor does it; markets are the gold standard (fensory.com, brier.fyi). If they beat us, say so. | Reinforces |
| 2 | **Reliability hardening pass** (one afternoon): offset cron to `7 * * * *`; weekly keep-alive commit (defeats the 60-day auto-disable); healthchecks.io dead-man-switch; "data may be stale" banner if >90 min old; SQLite artifact backup | GH cron piles up at `:00`; scheduled workflows silently die after 60 days idle; single-source outages are the #1 real failure (crontap.com, community #86087, healthchecks.io) | Reinforces (stale banner) |
| 3 | **Telegram flip-alerts** — message only when direction flips or a forecast resolves (reuse the existing `polymarket_betting` bot) | Real information events, not manufactured urgency; >5% prob shifts are the top re-entry trigger (avark.agency, Pushwoosh) | Low risk |
| 4 | **Dynamic OG share image per forecast** (`@vercel/og` / build-time card) — price + call + band + P(up) + benchmark score | Crypto-X moves on screenshots; the card *is* the content; ~1–2 days (f22labs, nextjs.org) | None |
| 5 | **About + Methodology + substantive Disclaimer pages** (real name, "no compensation / no promotion", how the engine works) | E-E-A-T table stakes AND the core of the *Lowe* publisher's-exclusion defense (natlawreview 2025, bracewell) | Reinforces |
| 6 | **Show N (resolved-forecast count) + rolling 30/90-day windows on every metric, with CIs** | Cumulative scores get gamed by early luck; small N → wide CIs → honest about limits | Reinforces |

---

## Tier 2 — Medium bets (high impact, medium effort)

**Methodology (peer-reviewed-verified):**
- **Replace symmetric EWMA with asymmetric GARCH (EGARCH / GJR-GARCH), Student-t errors, + Monte-Carlo
  simulation for the 1m/1y intervals.** Asymmetric variants beat symmetric out-of-sample across MSE/MAE/
  MAPE/QLIKE (Emerald RAUSP 2025, 648 specs). *Label it "volatility asymmetry (sign disputed in crypto)",
  NOT "leverage effect" — BTC shows an inverse leverage effect.* Impact: high · Effort: medium · the `arch`
  Python package does this. (This is "Phase 2" from the original spec.)
- **Regime detection → widen published intervals in turbulent periods.** GARCH accuracy provably degrades
  during systemic events (RAUSP 2025); Deribit option-implied densities cleanly cluster BTC into high/low-vol
  regimes (arXiv 2410.15195). **This is the most honesty-aligned upgrade** — it operationalizes "show more
  uncertainty when we're provably less reliable." Impact: high · Effort: low-medium.
- **Validate any LLM/ensemble overlay on the *published* metric, not point accuracy.** Hybrid GRU+GARCH
  improves point vol but NOT reliably VaR/tail (arXiv 2310.01063). → **A/B the Claude overlay vs the pure
  baseline on interval-coverage/CRPS** and publish the result. Impact: medium (guards false confidence).

**Scoring & calibration (cited):**
- **CRPS Skill Score vs random walk** as the primary probabilistic metric (reduces to MAE, lay-readable),
  + **pinball loss / interval coverage** ("our 80% band held X% of the time"), + **Brier decomposition**
  (reliability vs resolution), + a collapsible **Calibration panel** (reliability diagram + PIT histogram),
  + **Diebold-Mariano w/ HLN small-sample + Newey-West HAC** once N≳50 (label "pending, N=X" until then).
  (scores.readthedocs.io, real-statistics.com). Impact: high · Effort: medium. *Most of this was deferred
  to Phase 2 in the spec — the research confirms it's the right Phase 2.*

**Signals (verified):**
- **Add Deribit implied-vol / DVOL / skew** — a core, evidence-backed volatility input, free API (arXiv
  2401.02049). Impact: medium · Effort: low-medium.
- **ETF flows only as a hedged, fragile signal** — cointegrated with price but at just the 10% level and
  sample-fragile (Ledger 2025). Show with an explicit "weak/suggestive" caveat or skip. *Over-stating it
  would conflict with honesty.*

**Engagement / growth / comparables (cited):**
- **"Your call vs the model" game** (crowd % beside the model's P(up); reveal at resolution; no stakes, no
  implied edge). + **weekly plain-text email digest** (Buttondown). + **RSS feed of forecasts**. + a
  **single public `/data/latest.json`-style JSON "API"** (gets listed in free-API roundups → dev backlinks).
- **Resolved-vs-forecast history with explicit misses** (one public "we got it wrong" builds more trust than
  ten hidden wins), and **register forecasts on Brier.fyi / Metaculus** for *third-party* scoring you can't
  game. Impact: high for credibility.

---

## Tier 3 — Bigger / later

- **HAR model on intraday realized variance** — beats daily GARCH/EWMA (Bergsli et al., Elsevier RIBF 2022),
  but needs an intraday data feed + realized-variance pipeline. High effort; sequence after asymmetric GARCH.
- **Homepage at `vadym.online` root** + long-tail SEO content ("do bitcoin forecasts beat random walk",
  "how accurate are BTC predictions") using your own scored data as the unique angle.
- **More assets** (ETH/SOL) — more content, more reasons to return. Multiplies the engine.

---

## Honesty / risk watch-outs (the few things that *could* conflict)

- **Keep the regular hourly cadence; do NOT add out-of-band "urgent" alerts.** This is a *double* constraint:
  dark-pattern risk (manufactured urgency) AND a legal one — *Lowe* requires *regular, scheduled circulation*;
  event-timed market calls weaken the publisher's exclusion. (Flip-alerts are fine *because* they ride the
  hourly cycle.)
- **No visit-streaks / no user-vs-user leaderboards** — implies skill where luck dominates; use *calibration*
  streaks (correct-direction weeks) instead.
- **Never personalize** (no custom thresholds/portfolio projections) and **never monetize without a lawyer** —
  both break the *Lowe* "impersonal / disinterested" prongs and raise CFTC-CTA questions.
- **Don't claim a specific best fat-tailed distribution** — NIG-superiority did *not* survive verification;
  validate distribution choice empirically on your own data.
- "Not financial advice" alone is legally thin — substantive design (which you already have) does the work.

---

## Recommended next build bundle (my pick)

If building more: **(1) the reliability hardening pass** (protects the live site from silently dying — highest
value-per-hour), **(2) Polymarket/Kalshi comparison + CRPS/coverage scorecard upgrade** (the credibility core),
**(3) Telegram flip-alerts + OG share cards** (return visits + reach). Then the **asymmetric-GARCH + regime
upgrade** as the methodology centerpiece.

*Confidence: Tier-2 methodology/signals items are peer-reviewed + adversarially verified; scoring/engagement/
growth/comparables/legal/reliability items are cited single-pass research — solid leads, but the legal items
are practical guidance, not legal advice.*

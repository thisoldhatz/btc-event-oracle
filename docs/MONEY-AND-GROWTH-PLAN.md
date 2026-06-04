# BTC Event Oracle — Money & Growth Plan

> Research-backed monetization + viewership plan (5-angle deep research, June 2026:
> monetization · legal · automatable distribution · SEO/organic · comparables).
> Companion to `docs/IMPROVEMENT-ROADMAP.md` (which is about the *product*; this is about
> *revenue + audience*). For project context read `CLAUDE.md` first; for "where are we" read `STATUS.md`.

---

## 0. The one thing to internalize first

**Traffic is the binding constraint, not monetization.** Every revenue model below multiplies by
visitors, and right now visitors ≈ 0. At today's traffic, *every* monetization method — ads,
affiliates, subscriptions, donations — earns **$0–$30/month combined**, and most of that is rounding
error. The research is unanimous across all five angles:

> A zero-traffic crypto forecast site earns **under $10–$30/month for the first 6–12 months**
> regardless of how you monetize it. The real asset you are building is a **public, scored track
> record** — and that track record is *also* the thing that earns traffic, backlinks, and eventually
> money. Traffic earns money; the track record earns traffic. So the track record is the whole game.

Honest realistic ceiling, solo operator, **after** you have ~100k monthly pageviews **and** a 12-month
scored track record: **~$1,000–$3,500/month**. That is 18–24 months away at the earliest and is not
guaranteed. Treat this project's near-term value as **portfolio / credibility / résumé** (it can land
consulting or a job worth far more than the ad revenue), with direct revenue as a slow compounding
bonus.

This document is therefore **70% growth, 30% monetization**, because that's where the leverage is.

---

## 1. The central trade-off (read this before touching money)

This site has an unusual asset most crypto sites don't: a **legal shield + a credibility brand** that
are *the same thing*. Both come from being an **impersonal, disinterested, freely-available publisher**.

- **Legal:** The Investment Advisers Act "publisher's exclusion" (*Lowe v. SEC*, 1985) and the parallel
  CFTC "publisher" carve-out for Commodity Trading Advisors protect you **only while** the site stays
  (1) impersonal — no advice tailored to an individual, (2) **disinterested** — you don't have a
  financial stake in which way BTC goes or where people trade, and (3) of general/regular circulation.
  A 2024 federal court kept this shield intact for **Seeking Alpha** *even though it's a paid
  subscription site*, precisely because the content stayed impersonal and generally available. So
  monetization **per se** doesn't break the shield — **personalization** and **financial interest in the
  outcome** do. ("Not financial advice" in a footer is legally near-meaningless on its own — what
  matters is the substance.)
- **Brand:** The entire pitch is "the forecaster honest enough to score itself against a coin-flip in
  public." The moment the page is plastered with "Trade BTC with 100x leverage at [exchange]" affiliate
  banners, that pitch dies — for readers *and* for Google's E-E-A-T quality raters on a YMYL
  ("Your Money or Your Life") site.

So every monetization option sits on a **dial** between two poles:

```
BRAND/SHIELD-PRESERVING  <───────────────────────────────────────>  REVENUE-MAXIMIZING
 (slow money, keeps the legal       (faster money, erodes both the legal shield
  shield + the honest brand)         and the credibility that earns traffic)
```

The rest of §2 ranks options along this dial so you can choose your point on it deliberately instead
of by accident. **My recommendation: stay hard on the left until you have real traffic, then move one
notch right at a time, only into the legally-clean options.**

---

## 2. Monetization, ranked by where it sits on the dial

### TIER A — Brand- & shield-preserving (do these; ~zero legal risk)

| Option | Effort | Revenue @ <1k/mo | Revenue @ 100k/mo | Legal/brand cost |
|---|---|---|---|---|
| **A-ADS display banner** (one slot) | Low | $1–$5 | $400–$1,000 | ~None — no traffic minimum, pays in BTC, generic display |
| **Crypto tip address / GitHub Sponsors / Ko-fi** | Low | $0–$50 | $0–$50 | None — voluntary |
| **Tax-software affiliate** (CoinLedger 25% lifetime, Koinly) | Low | $0–$50 | $300–$700 (tax season) | **Lowest-risk affiliate** — you're helping people *report* trades, not *make* them; no stake in BTC direction |
| **Hardware-wallet affiliate** (Ledger/Trezor ~10%/sale) | Low | $0–$20 | $100–$300 | Minimal — recommending *custody/safety*, not a trading venue |
| **Pro "depth" tier** (raw JSON feed, full calibration history, daily vs weekly) | Med | $0–$100 | $500–$5,000 | **Safe IF structured right** — you sell *methodological depth/data*, identical for everyone (Seeking-Alpha-style), **never** personalized picks |

**Why these are safe:** none of them give you a financial interest in *which direction BTC goes* or in
*readers opening a trading account*. Ads are third-party and generic. Tax/wallet affiliates are
off-to-the-side utilities. The Pro tier sells *depth of the same impersonal data to everyone* — the
exact structure that saved Seeking Alpha — as long as it is **data/analysis, never tailored advice**.

**The one structural rule for the Pro tier (do not violate):** it must be "the full dataset + weekly
calibration update + raw API," available identically to every subscriber. The instant it becomes
"premium *signals*" or "what to buy," it (a) shrinks "general circulation," (b) implies proprietary
investment advice, and (c) collides with both IAA and CFTC/CTA. If you ever go there, get a securities
lawyer **first**.

### TIER B — Moderate risk (only with structure, disclosure, and real traffic)

| Option | Effort | Revenue @ 50k/mo | Legal/brand cost |
|---|---|---|---|
| **Exchange affiliate** (Coinbase 50%/3mo, Binance 20–50%, Kraken 20% lifetime) | Low–Med | $20–$200 | **HIGH** — highest $/visitor, but ties your income to readers trading → directly attacks the "disinterested" prong. FTC **mandatory disclosure** ($50k+/violation). |
| **Crypto ad network** (Coinzilla/Cointraffic/Bitmedia, €3–€10 CPM) | Low | $200–$1,000 | Low **only if** you reject exchange/trading-platform creatives; a "Buy BTC 100x at X" ad implies endorsement on a forecast page |

**If you ever do exchange affiliate** (the research says it's the single most dangerous move for *this*
site): isolate it on a separate `/resources` or `/exchanges` page, *never* co-located with a forecast
or a "buy" CTA; use neutral language ("exchange options," not "use this one"); add a clear, conspicuous
sitewide FTC affiliate disclosure. Even then it's the fastest way to lose the shield. Kraken's
lifetime rev-share is *marginally* cleaner than CPA sign-up bounties because it tracks real activity
rather than paying you a bounty to push sign-ups — but "cleaner" here is relative.

### TIER C — Do not do (collapses shield + brand simultaneously)

- **Sponsored "market outlook" / branded forecast content.** A sponsor (ETF, exchange, fund) paying
  for content on a site that issues directional BTC forecasts gives you a financial interest in
  promoting their product → destroys "disinterested," likely triggers IAA **and** CTA registration.
  *Highest risk in the entire analysis. Never.*
- **Paid/personalized "premium signals," "what to buy," early calls sold as an edge.** Implies advice +
  shrinks circulation. This is the *Lowe* line.
- **Affiliate links co-mingled with directional calls / "buy now" CTAs.**

### Data / API access — the legally *cleanest* high-value product, but it's Year 2

A forecast-history API ($9–$29/mo tiers, EODHD-style) sold to quants, journalists, and other
aggregators is the highest-quality, lowest-risk revenue — you're selling a *timestamped, impersonal
record*, not advice. But it finds **zero** customers until there's a ~12-month track record to query.
**Build the data export now (cheap), sell access later.** File under Year 2.

---

## 3. Growth & distribution — the actual leverage

Three buckets: **safely automatable** (set-and-forget, runs from the existing GitHub Actions job),
**manual high-value** (do by hand, rarely), and **ban-risky** (don't automate — it backfires).

### 3A. Safely automatable (wire into the hourly engine; ~zero ongoing cost)

Priority order for a solo operator:

1. **Bluesky bot** — *best first move.* AT Protocol API is free, generous limits (1,666 posts/hr),
   officially bot-friendly with self-labeling. ~20 lines of Python in the existing Actions run. Post
   the forecast summary + OG card + link on each **direction flip** (not hourly — that's spam). Audience
   is small but technical and bot-tolerant. **$0/mo, zero legal risk** (disinterested publisher posting
   a link). **Build this first.**
2. **Nostr bot** — add to the same Actions job (~10 lines, `nostr-sdk`). Free, no rate limits,
   Bitcoin-native ideological audience. Tiny but perfectly aligned. Near-zero marginal effort once
   Bluesky's flip-detection exists.
3. **Telegram broadcast channel** — *the user previously deferred this ("everything except the Telegram
   thing"), so confirm before building.* Free, unlimited, genuinely useful as a flip-alert channel.
   Bootstrapping subscribers is the hard part — cross-post the channel link in every other bio. Keep it
   **free and unmonetized** (paid signals = the §2 Tier-C trap). Realistic 6-mo: 50–200 subs.
4. **RSS aggregator submissions** — one-time, 30 min. Submit the existing `/btc/data/rss.xml` to
   Feedspot crypto, rsscrypto.com, CoinCodeCap. 20–80 recurring high-intent readers. Durable.
5. **X / Twitter — text-only flip-alerts only.** *Brutal 2026 reality:* posts **containing a URL** cost
   **$0.20 each** on pay-per-use → hourly-with-link ≈ **$146/mo**, not viable. Text-only (no link, just
   "vadym.online/btc" as plain text) drops to ~$0.015/post. **Mitigation: post only on flips (2–4×/day),
   text-only → under ~$3/mo.** Verified badge needs $8/mo Blue. Lowest priority; optional.
6. **Programmatic SEO pages** — *highest long-term ROI of anything in this document.* See §3D.

> **Engineering note:** items 1–5 all key off the same trigger the dashboard already computes — a
> **direction flip** in the 1-week forecast (the "changed its mind" timeline already detects this). Build
> one `events/social/` publisher module that fires on flip + resolution events and fans out to
> Bluesky/Nostr/(Telegram)/X behind per-channel secrets. One mechanism, many channels, all fail-soft
> like the rest of the engine.

### 3B. Manual, high-value (do by hand — rare, deliberate, never automated)

- **One Show-HN/Show-r/algotrading post** with a genuine technical write-up of the GJR-GARCH + bounded-
  Claude engine and the *open scoring vs random walk*. r/algotrading tolerates real technical
  show-and-tell from a human. A single good post ≈ 200–500 visitors. **Post once, by hand.** (r/Bitcoin,
  r/CryptoCurrency ban self-promo + require account age/karma — skip or tread very carefully.)
- **Hacker News "Show HN"** on a launch-worthy milestone (e.g., "90 days of publicly scored BTC
  forecasts vs a random walk — here's the calibration data"). Front-page is a lottery, but the backlink
  + traffic spike is real and the methodology angle is HN-shaped.
- **Product Hunt launch** — one-time spike (200–800 visits, then ~0). Treat as a **backlink event**, not
  sustained traffic.
- **HARO / Connectively (Featured.com, free again in 2026)** — once you have **90+ days of scored data**,
  answer journalist queries with your calibration record as the hook ("we track our accuracy openly vs a
  random walk; here's what 90 days shows"). **One CoinDesk/Forbes citation > 100 directory links.** This
  is the highest-quality backlink path; start it the moment the track record exists.
- **Developer/tool directories:** GitHub `awesome-crypto` / `awesome-algotrading` lists, AlternativeTo,
  CoinGecko "Tools." One-time submissions, durable backlinks.

### 3C. Ban-risky — do NOT automate

- **Automated Reddit posts** — Reddit's Responsible Builder Policy bans bot posts; you'll be
  shadowbanned within weeks and risk getting the **domain flagged**. Manual only (see 3B).
- **Automated mass D^Ming / comment-dropping / X reply-spam** — burns the brand, risks bans, and the
  whole credibility pitch is incompatible with spam.
- **IFTTT/Zapier RSS re-piping** — redundant once native bots exist; breaks silently. Skip.

### 3D. Programmatic SEO — the compounding engine (build this; highest non-social ROI)

This is where the site's unique asset becomes traffic. You already generate, every hour, structured
forecast + outcome data nobody else has. Turn it into **statically-generated, individually-rankable
pages** (Next.js SSG, already the stack):

- **`/accuracy`** (a.k.a. the public scorecard as its own indexable page) — running calibration table,
  Brier vs random walk, beat/loss rate, CRPSS. This is the E-E-A-T centerpiece *and* the most
  citable/linkable artifact you have.
- **`/signals/fear-greed`, `/signals/funding`, …** — each signal explained, with its historical
  readings overlaid on subsequent forecast outcomes. Long-tail informational queries with near-zero
  competition.
- **`/forecast/2026-W23` (one static page per past forecast)** — at 6–12 months you'll have thousands
  of these; each is independently rankable, with `Dataset`/`Article` schema markup. This is the
  CoinGecko/CoinCodex programmatic playbook applied to *your own scored record*.
- **`/methodology`** — GJR-GARCH + signals + the bounded-overlay, with citations.

**Why it works:** Google rewards utility-driven programmatic pages backed by genuine unique data, and a
**public track record** is exactly the E-E-A-T story YMYL crypto needs. It is **100% compatible with the
honesty posture** — you're literally publishing your own scored record. Effort: 2–3 days engineering,
automatic thereafter.

### 3E. The single highest-leverage 2026 move: GEO (AI-answer visibility)

A material share of "is there an accurate bitcoin forecast site?" queries now resolve inside ChatGPT /
Perplexity / Gemini, not Google. Sites *cited* in LLM answers get ~35% more click-through than uncited
organic. To get cited: write `/methodology` and `/accuracy` as **clean, quotable prose with explicit,
dated, named claims** — e.g., *"As of 2026-06-03, our 1-week directional Brier score is 0.24 vs a
random-walk baseline of 0.25, over N=140 resolved forecasts."* That sentence is exactly what an LLM
pulls when asked "which bitcoin forecast sites publish their accuracy?" **Low effort, possibly the
biggest single lever for a data-rich site with no backlinks yet.** Build the accuracy/methodology pages
to be *quotable*.

### 3F. E-E-A-T floor (non-negotiable for a YMYL site, or Google suppresses you regardless)

- **Named author** with a real LinkedIn + a one-line quant/finance bio. (Anonymous YMYL = low-trust =
  suppressed.)
- **"Not financial advice" disclosure above the fold**, not buried (also *strengthens* the legal
  shield).
- **`Organization` + `sameAs` schema** linking the GitHub repo + LinkedIn.
- **Methodology page with citations.** You already have the substance — just surface it.

Disclosures here do double duty: they're an SEO trust signal **and** they reinforce the publisher's
exclusion.

---

## 4. The honest revenue trajectory

| Stage (months) | Monthly visits | Realistic total revenue | What's driving it |
|---|---|---|---|
| Launch (0–6) | <1k | **$0–$30** | A-ADS pennies + maybe a tip. Track record is forming. |
| Growth (6–12) | 5k–20k | **$50–$300** | A-ADS + small Pro tier (at ~1k email subs) + tax affiliate. |
| Scale (12–18) | 50k+ | **$300–$1,000** | Coinzilla display + tax/wallet affiliate + Pro tier growing. |
| Mature (18–24+) | 100k+ | **$1,000–$3,500** | Display + one clean affiliate + Pro tier + **Data API launch** (needs the 12-mo record). |

These assume you execute the growth plan well *and* the track record holds up. They are **not**
guaranteed. Comparables for scale-context: CoinCodex ~1.5M visits/mo, DigitalCoinPrice ~292k/mo,
CoinGecko tens of millions — all with 7–10 years of domain authority. You are starting from zero; this
is a **long compounding asset**, not an income source this year.

---

## 5. The sequenced roadmap (what to actually do, in order)

### Phase 1 — "Make it earn-ready & citable" (now; ~1 week of build)
*Goal: turn the existing scored record into something discoverable, quotable, and minimally monetized.
Pure brand-preserving Tier-A + the SEO/GEO foundation. Nothing here risks the shield.*
1. **E-E-A-T floor** (§3F): named author + LinkedIn, above-the-fold disclosure, `Organization`/`Dataset`
   schema, methodology citations. *(Low effort, unlocks everything else.)*
2. **`/accuracy` + `/methodology` as standalone, GEO-quotable pages** (§3D/3E) — dated named claims.
3. **A-ADS single banner slot** + **crypto tip address** in the footer (§2 Tier A).
4. **RSS aggregator submissions** (§3A.4) — 30 min, one-time.
5. **Bluesky + Nostr flip-bots** via one `events/social/` publisher on the existing Actions run (§3A.1–2).

### Phase 2 — "Build the audience" (months 1–6)
*Goal: distribution + the compounding SEO engine. Still all left-of-dial.*
6. **Programmatic SEO: per-forecast `/forecast/YYYY-Www` SSG pages + `/signals/*` pages** (§3D).
7. **Free email list** (Buttondown/Beehiiv) — weekly digest of the forecast + the calibration update.
8. **The one manual r/algotrading + Show-HN write-up** at a real milestone (§3B).
9. **(Optional) X text-only flip-alerts** if you want the presence (§3A.5, keep it ~$3/mo).
10. **(If you want it) Telegram channel** — *confirm first; previously deferred.*

### Phase 3 — "Monetize the audience" (months 6–12, gated on traffic ≥ ~5–10k/mo + 90-day record)
*Goal: first real (still-clean) dollars. Move one notch right, carefully.*
11. **Pro "depth" tier** at ~1k email subs: raw JSON feed + full calibration history + daily-vs-weekly,
    identical for all subscribers (§2 Tier A — mind the structural rule).
12. **Tax-software + hardware-wallet affiliates** on a separate `/resources` page with FTC disclosure
    (§2 Tier A).
13. **HARO/Connectively** outreach using the now-90+-day record (§3B) — chase the one big citation.
14. **Migrate display A-ADS → Coinzilla** once you clear ~50k impressions/mo (§2 Tier B, generic
    creatives only).

### Phase 4 — "Scale the clean stuff" (months 12–24, gated on 12-mo record)
15. **Data/forecast-history API** — the legally cleanest high-value product, now that there's a record to
    sell (§2).
16. Reassess exchange affiliate **only** if you've decided to trade brand for revenue, **only** with legal
    counsel, **only** isolated on `/resources` (§2 Tier B). Default recommendation: **don't.**
17. Multi-asset (ETH/SOL) as a content/traffic multiplier (already in `IMPROVEMENT-ROADMAP.md`) — every
    new asset multiplies the programmatic-SEO surface area.

---

## 6. What I (Claude) can build for you right now, on request

All of these are code I can implement the usual way (brainstorm→plan→subagent-TDD), no new accounts
needed except where noted:

- **`events/social/` flip-publisher + Bluesky bot** (Phase 1.5) — needs a free Bluesky app password as a
  GitHub secret. Nostr is keypair-only, no account.
- **`/accuracy`, `/methodology`, `/forecast/[week]`, `/signals/[id]` programmatic pages** + `Dataset`/
  `Organization`/`Article` JSON-LD schema (Phase 1.2 / 2.6).
- **A-ADS ad slot + tip-address footer + FTC/affiliate disclosure component** (Phase 1.3) — needs your
  A-ADS unit id + BTC address.
- **GEO-formatting pass** on the accuracy/methodology copy so it's LLM-quotable (Phase 1.2).
- **Buttondown/Beehiiv digest hook** — engine emits a ready-to-send weekly digest from the snapshot
  (Phase 2.7).
- **Pro-tier data export** (stable public JSON/CSV of full history + calibration) — the technical
  groundwork for both the Pro tier and the eventual API (Phase 3.11 / 4.15).

Tell me which and I'll spec + build it. My standing recommendation: **do all of Phase 1 next** — it's
~a week of work, costs ~nothing, risks nothing legally, and it's the foundation every later phase
multiplies on.

---

## 7. Decisions that are yours (I won't make these for you)

1. **How far right on the dial are you willing to go?** My recommendation: stay in Tier A
   indefinitely; only touch Tier B (generic display ads, isolated tax/wallet affiliates) at real
   traffic; never Tier C. But it's your project — if you'd rather maximize revenue and accept the brand/
   legal erosion, say so and I'll plan accordingly (with the disclosures + isolation that at least
   *reduce* the risk).
2. **Telegram: yes or no?** You deferred it once. It's a clean, free distribution channel if kept
   unmonetized. Want it in Phase 2?
3. **Are you willing to put your real name + LinkedIn on it?** The E-E-A-T floor (and thus most of the
   SEO upside) depends on a named author. If you'd rather stay anonymous, the growth ceiling drops and
   we lean harder on GEO + the open-source-credibility angle instead.
4. **Any budget at all for paid acceleration?** Everything above is $0-cost organic. If you'd spend even
   $20–50/mo, options change (X verified, small promoted posts) — but the research says organic +
   track-record is the right play for *this* site and paid promo of a forecast site carries its own
   credibility cost.

---

*Sources (selected): Lowe v. SEC 472 U.S. 181; Greenberg Traurig & Katten on the 2024 Seeking Alpha
publisher-exclusion dismissal; Bracewell ("'not financial advice' won't save you"); Proskauer on CFTC/
CTA publisher carve-out; A-ADS/Coinzilla/Cointraffic/Bitmedia publisher terms; Binance/Coinbase/Kraken/
CoinLedger/Ledger affiliate terms; Bluesky AT-Proto bot docs; X API 2026 pricing (Blotato/Postproxy);
Reddit Responsible Builder Policy; Feedspot/rsscrypto aggregators; icoda/digispot/heroicrankings on
2026 YMYL SEO & E-E-A-T; cointelligence on GEO; coldchain on programmatic crypto SEO; Similarweb traffic
for CoinCodex/DigitalCoinPrice. Full URLs in the session research output.*

import fs from "node:fs";
import path from "node:path";
import type { Scores, Extras } from "./types";

// Build-time data layer for the static SEO/GEO pages. Reads the engine's JSON
// baked into web/public/data (the deploy workflow refreshes these from the live
// host before building; the committed copies are the local/first-build fallback).

export interface SignalPoint {
  observed_at: string;
  value: number | null;
  delta: number | null;
  interpretation: string;
}
export interface RecapItem {
  horizon: string;
  run_at: string;
  target_at: string;
  central: number;
  realized_price: number;
  p_up: number;
  up_outcome: number;
  covered: boolean | null;
}
export interface WeekRecap {
  week: string;
  n: number;
  hit_rate: number | null;
  coverage_rate: number | null;
  avg_pct_err: number | null;
  items: RecapItem[];
}
export interface SeoData {
  as_of: string | null;
  signals: Record<string, SignalPoint[]>;
  recaps: WeekRecap[];
}

const EMPTY_SEO: SeoData = { as_of: null, signals: {}, recaps: [] };

function readJson<T>(name: string, fallback: T): T {
  try {
    const p = path.join(process.cwd(), "public", "data", name);
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export const getSeo = (): SeoData => readJson<SeoData>("seo.json", EMPTY_SEO);
export const getScores = (): Scores | null => readJson<Scores | null>("scores.json", null);
export const getExtras = (): Extras | null => readJson<Extras | null>("extras.json", null);

/** Public URL base (absolute) for canonical/schema/sitemap. */
export const SITE = "https://vadym.online/btc";

/** Signal explainer pages, keyed by URL slug. `key` maps to the engine signal name. */
export interface SignalMeta {
  key: string;
  title: string;
  short: string; // one-line definition (GEO-quotable)
  unit: string;
  body: string; // a paragraph of genuinely useful explanation
}
export const SIGNALS: Record<string, SignalMeta> = {
  "fear-greed": {
    key: "fear_greed",
    title: "Crypto Fear & Greed Index",
    short: "A 0–100 gauge of crypto market sentiment, where low = fear and high = greed.",
    unit: "/100",
    body: "The Crypto Fear & Greed Index aggregates volatility, momentum, social media, and survey signals into a single 0–100 score. Readings under 25 are labelled “Extreme Fear” (widespread selling and caution) and over 75 “Extreme Greed” (euphoria). It is a contrarian-leaning mood gauge, not a price predictor — historically, extreme fear has sometimes preceded rebounds. The Oracle reads it each hour as one of several world-event signals and may, within hard caps, widen its forecast band when sentiment is extreme.",
  },
  funding: {
    key: "funding_rate",
    title: "Bitcoin perpetual funding rate",
    short: "The periodic fee leveraged perp traders pay; positive means longs pay shorts (crowded long).",
    unit: "%",
    body: "On perpetual futures, the funding rate is a small fee exchanged between long and short traders every few hours to keep the contract near the spot price. A positive rate means longs pay shorts — more traders are leveraged long, which can signal a “crowded” market more prone to a sharp unwind. The Oracle reads OKX BTC-USD-SWAP funding hourly as a leverage/fragility signal; it is suggestive context, never a directional call on its own.",
  },
  "open-interest": {
    key: "open_interest",
    title: "Bitcoin open interest",
    short: "The total value of outstanding leveraged futures positions — how much “fuel” is riding on price moves.",
    unit: "BTC",
    body: "Open interest is the number of futures/perp contracts currently open. Rising open interest means more money is riding on leveraged bets, which can amplify and accelerate price swings in either direction (more positions to liquidate). It says nothing about direction by itself; the Oracle uses it as a volatility-context signal alongside funding and implied volatility.",
  },
  "implied-vol": {
    key: "implied_vol",
    title: "Bitcoin implied volatility (Deribit DVOL)",
    short: "The options market's forward-looking estimate of how much Bitcoin will move (annualised %).",
    unit: "%",
    body: "Deribit's DVOL index is the market-implied expectation of Bitcoin's volatility over the next 30 days, derived from options prices. Higher DVOL means traders are paying up for protection and expect bigger swings. Because it is forward-looking and priced by real money, implied volatility is one of the more evidence-backed inputs the Oracle reads — it directly informs how wide the forecast range should be.",
  },
  "news-tone": {
    key: "news_tone",
    title: "Bitcoin news tone (GDELT)",
    short: "Whether global news coverage of Bitcoin is, on balance, positive or negative right now.",
    unit: "",
    body: "The Oracle samples global news coverage of Bitcoin (via GDELT and crypto headlines) and condenses its average tone. It is a noisy, contextual signal — news is often already priced in — so it is used only as one humble input among several, never to make a confident directional call.",
  },
};

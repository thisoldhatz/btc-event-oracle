import type { Forecast, Horizon } from "./types";

export const HORIZON_ORDER: Horizon[] = ["1w", "1m", "1y"];
export const HORIZON_LABEL: Record<Horizon, string> = {
  "1w": "1 Week",
  "1m": "1 Month",
  "1y": "1 Year",
};

export function fmtUsd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
export function fmtPct(p: number, digits = 0): string {
  return (p * 100).toFixed(digits) + "%";
}
export function fmtSignedBps(b: number): string {
  return (b >= 0 ? "+" : "") + Math.round(b) + " bps";
}
export function sortForecasts(fs: Forecast[]): Forecast[] {
  return [...fs].sort(
    (a, b) => HORIZON_ORDER.indexOf(a.horizon) - HORIZON_ORDER.indexOf(b.horizon),
  );
}
export function confidenceClass(label: string): string {
  switch (label.toLowerCase()) {
    case "high":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "medium":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}
export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

import type { Signal } from "./types";

export function relativeTime(iso: string, now: number = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function timeUntil(targetIso: string, now: number = Date.now()): string {
  const t = Date.parse(targetIso);
  if (Number.isNaN(t)) return "";
  const s = Math.floor((t - now) / 1000);
  if (s <= 0) return "resolved";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export type SignalTone = "fear" | "greed" | "up" | "down" | "neutral";
export interface SignalDisplay {
  label: string;
  value: string;
  delta: string | null;
  hint: string;
  tone: SignalTone;
}

export function signalDisplay(s: Signal): SignalDisplay {
  const v = s.value ?? 0;
  const delta =
    s.delta === null || s.delta === undefined
      ? null
      : `${s.delta >= 0 ? "+" : ""}${Math.round(s.delta)}`;
  switch (s.signal) {
    case "fear_greed":
      return {
        label: "Fear & Greed", value: `${Math.round(v)}/100`, delta,
        hint: s.interpretation, tone: v < 25 ? "fear" : v > 75 ? "greed" : "neutral",
      };
    case "funding_rate": {
      const pct = v * 100;
      return {
        label: "Perp funding", value: `${pct >= 0 ? "+" : ""}${pct.toFixed(4)}%`, delta,
        hint: s.interpretation, tone: pct >= 0 ? "up" : "down",
      };
    }
    case "open_interest":
      return {
        label: "Open interest", value: Math.round(v).toLocaleString("en-US"), delta,
        hint: s.interpretation, tone: "neutral",
      };
    case "news_tone":
      return {
        label: "News tone", value: v.toFixed(2), delta,
        hint: s.interpretation, tone: v >= 0 ? "up" : "down",
      };
    case "implied_vol":
      return { label: "Implied vol", value: `${Math.round(v)}%`, delta,
               hint: s.interpretation, tone: (s.delta ?? 0) > 0 ? "down" : "up" };
    default:
      return { label: s.signal, value: String(s.value ?? "—"), delta, hint: s.interpretation, tone: "neutral" };
  }
}

// Per-signal freshness budgets (hours). A reading older than this is flagged so a
// stale feed never silently looks as live as a fresh one.
const SIGNAL_MAX_AGE_H: Record<string, number> = {
  fear_greed: 36, // daily index
  funding_rate: 12, // ~8h funding cycle
  open_interest: 6,
  implied_vol: 12,
  news_tone: 72, // GDELT ~3-day window
};

export function signalStale(
  observed_at: string,
  signal: string,
  now: number = Date.now(),
): { stale: boolean; ageH: number } | null {
  if (!observed_at) return null;
  const t = Date.parse(observed_at);
  if (Number.isNaN(t)) return null;
  const ageH = Math.max(0, (now - t) / 3_600_000);
  return { stale: ageH > (SIGNAL_MAX_AGE_H[signal] ?? 24), ageH };
}

export function regimeNote(label: string): string {
  if (label === "high") return "High-volatility regime — intervals widened (the model is less reliable in turbulence).";
  if (label === "elevated") return "Elevated volatility — intervals modestly widened.";
  return "";
}

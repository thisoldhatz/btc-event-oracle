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

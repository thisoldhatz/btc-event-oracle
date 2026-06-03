// lib/chart.ts
import type { HistPoint } from "./types";

export interface BandPoint {
  t: number;        // epoch ms (numeric x-axis)
  label: string;    // run_at iso
  lower: number;
  band: number;     // upper - lower (stacked on top of lower for the shaded area)
  central: number;
  upper: number;
  p_up: number;
}

export function toBandSeries(points: HistPoint[]): BandPoint[] {
  return points.map((p) => ({
    t: new Date(p.run_at).getTime(),
    label: p.run_at,
    lower: p.lower,
    band: p.upper - p.lower,
    central: p.central,
    upper: p.upper,
    p_up: p.p_up,
  }));
}

export interface MergedPoint {
  t: number;
  label: string;
  lower?: number;
  band?: number;
  central?: number;
  upper?: number;
  actual?: number;
}

export function mergeActual(
  band: BandPoint[],
  actual: { t: number; price: number }[],
): MergedPoint[] {
  const map = new Map<number, MergedPoint>();
  for (const b of band) {
    map.set(b.t, { t: b.t, label: b.label, lower: b.lower, band: b.band, central: b.central, upper: b.upper });
  }
  for (const a of actual) {
    const e = map.get(a.t);
    if (e) e.actual = a.price;
    else map.set(a.t, { t: a.t, label: new Date(a.t).toISOString(), actual: a.price });
  }
  return Array.from(map.values()).sort((x, y) => x.t - y.t);
}

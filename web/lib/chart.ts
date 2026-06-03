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

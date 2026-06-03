// lib/results.ts
import type { ResultItem, Horizon } from "./types";

export interface CallRow {
  horizon: Horizon;
  target_at: string;
  predictedUp: boolean;
  actualUp: boolean;
  hit: boolean;
  central: number;
  realized: number;
  inRange: boolean | null;
  pctErr: number;
}

export function buildCallRows(results: ResultItem[]): CallRow[] {
  return results.map((r) => {
    const predictedUp = r.p_up >= 0.5;
    const actualUp = r.up_outcome === 1;
    return {
      horizon: r.horizon, target_at: r.target_at, predictedUp, actualUp,
      hit: predictedUp === actualUp, central: r.central, realized: r.realized_price,
      inRange: r.covered,
      pctErr: r.realized_price ? (Math.abs(r.realized_price - r.central) / r.realized_price) * 100 : 0,
    };
  });
}

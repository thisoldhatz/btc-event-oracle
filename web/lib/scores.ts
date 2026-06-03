import type { Scores, Horizon } from "./types";
import { HORIZON_ORDER, HORIZON_LABEL } from "./format";

export interface ScoreRow {
  horizon: Horizon;
  label: string;
  n: number;
  hasData: boolean;
  brier: string;
  brierBase: string;
  bss: string;
  mape: string;
  coverage: string;
  verdict: string;
}

function verdictFor(bss: number | null | undefined): string {
  if (bss === null || bss === undefined) return "—";
  if (bss > 0.02) return "Beating random walk";
  if (bss < -0.02) return "Worse than random walk";
  return "≈ random walk (expected)";
}

export function buildScoreRows(scores: Scores): ScoreRow[] {
  return HORIZON_ORDER.map((h) => {
    const s = scores?.[h] ?? { n: 0 };
    if (!s.n) {
      return {
        horizon: h, label: HORIZON_LABEL[h], n: 0, hasData: false,
        brier: "—", brierBase: "—", bss: "—", mape: "—", coverage: "—",
        verdict: "Insufficient data",
      };
    }
    return {
      horizon: h, label: HORIZON_LABEL[h], n: s.n, hasData: true,
      brier: (s.brier ?? 0).toFixed(3),
      brierBase: (s.brier_base ?? 0).toFixed(3),
      bss: s.bss === null || s.bss === undefined ? "—" : s.bss.toFixed(2),
      mape: s.mape === null || s.mape === undefined ? "—" : s.mape.toFixed(1) + "%",
      coverage: s.coverage === null || s.coverage === undefined ? "—" : (s.coverage * 100).toFixed(0) + "%",
      verdict: verdictFor(s.bss),
    };
  });
}

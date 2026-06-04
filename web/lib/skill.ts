// lib/skill.ts
import type { Scores, Horizon } from "./types";
import { HORIZON_ORDER, HORIZON_LABEL } from "./format";

export interface SkillRow {
  horizon: Horizon;
  label: string;
  n: number;
  hasData: boolean;
  crpss: string;
  bss: string;
  coverage: string;
  abVerdict: string;
}

function fmtSkill(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return `${x >= 0 ? "+" : ""}${x.toFixed(2)}`;
}

export function buildSkillRows(scores: Scores): SkillRow[] {
  return HORIZON_ORDER.map((h) => {
    const s = scores?.[h] ?? { n: 0 };
    if (!s.n) {
      return { horizon: h, label: HORIZON_LABEL[h], n: 0, hasData: false,
               crpss: "—", bss: "—", coverage: "—", abVerdict: "—" };
    }
    const cov = s.coverage == null ? "—"
      : `${Math.round(s.coverage * 100)}%${s.coverage_nominal != null ? ` (target ${Math.round(s.coverage_nominal * 100)}%)` : ""}`;
    let abVerdict = "—";
    if (s.ab && s.ab.model_brier != null && s.ab.baseline_brier != null) {
      const d = s.ab.baseline_brier - s.ab.model_brier;     // positive => overlay better
      abVerdict = d > 0.005 ? "Claude overlay beats baseline" : d < -0.005 ? "baseline beats overlay" : "overlay ≈ baseline";
    }
    return { horizon: h, label: HORIZON_LABEL[h], n: s.n, hasData: true,
             crpss: fmtSkill(s.crpss), bss: fmtSkill(s.bss), coverage: cov, abVerdict };
  });
}

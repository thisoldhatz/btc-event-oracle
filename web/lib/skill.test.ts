// lib/skill.test.ts
import { describe, it, expect } from "vitest";
import { buildSkillRows } from "@/lib/skill";
import type { Scores } from "@/lib/types";

describe("buildSkillRows", () => {
  it("flags insufficient data when n=0", () => {
    const rows = buildSkillRows({ "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores);
    expect(rows[0].hasData).toBe(false);
  });
  it("formats CRPSS, coverage vs nominal, and the A/B verdict", () => {
    const scores = { "1w": { n: 20, crpss: 0.05, coverage: 0.55, coverage_nominal: 0.6,
        ab: { n: 20, model_brier: 0.22, baseline_brier: 0.25 } }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores;
    const r = buildSkillRows(scores)[0];
    expect(r.hasData).toBe(true);
    expect(r.crpss).toBe("+0.05");
    expect(r.coverage).toBe("55% (target 60%)");
    expect(r.abVerdict).toMatch(/overlay (beats|helps)/i);
  });
});

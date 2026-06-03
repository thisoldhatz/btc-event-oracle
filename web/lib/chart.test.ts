// lib/chart.test.ts
import { describe, it, expect } from "vitest";
import { toBandSeries } from "@/lib/chart";
import type { HistPoint } from "@/lib/types";

const pts: HistPoint[] = [
  { run_at: "2026-06-03T20:02:59+00:00", target_at: "x", central: 65311, lower: 62185, upper: 68593, p_up: 0.5 },
  { run_at: "2026-06-03T20:08:21+00:00", target_at: "x", central: 65162, lower: 61589, upper: 68942, p_up: 0.49 },
];

describe("toBandSeries", () => {
  it("computes band = upper - lower and a numeric time axis", () => {
    const s = toBandSeries(pts);
    expect(s).toHaveLength(2);
    expect(s[0].band).toBeCloseTo(68593 - 62185, 3);
    expect(s[0].lower).toBe(62185);
    expect(s[0].central).toBe(65311);
    expect(typeof s[0].t).toBe("number");
    expect(s[1].t).toBeGreaterThan(s[0].t);   // chronological
  });
  it("handles empty history", () => {
    expect(toBandSeries([])).toEqual([]);
  });
});

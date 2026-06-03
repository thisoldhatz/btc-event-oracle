// lib/results.test.ts
import { describe, it, expect } from "vitest";
import { buildCallRows } from "@/lib/results";
import type { ResultItem } from "@/lib/types";

const r = (over: Partial<ResultItem>): ResultItem => ({
  horizon: "1w", run_at: "t", target_at: "t2", central: 100, lower: 90, upper: 110,
  p_up: 0.6, spot_at_issue: 95, realized_price: 105, up_outcome: 1, covered: true, ...over,
});

describe("buildCallRows", () => {
  it("scores a correct up-call as a hit", () => {
    const [row] = buildCallRows([r({})]);
    expect(row.predictedUp).toBe(true);
    expect(row.actualUp).toBe(true);
    expect(row.hit).toBe(true);
    expect(row.inRange).toBe(true);
    expect(row.pctErr).toBeCloseTo(Math.abs(105 - 100) / 105 * 100, 4);
  });
  it("marks a wrong direction as a miss", () => {
    const [row] = buildCallRows([r({ p_up: 0.6, up_outcome: 0 })]);
    expect(row.hit).toBe(false);
  });
});

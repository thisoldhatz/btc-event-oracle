import { describe, it, expect } from "vitest";
import { buildScoreRows } from "@/lib/scores";
import type { Scores } from "@/lib/types";

describe("buildScoreRows", () => {
  it("marks empty horizons as insufficient data", () => {
    const rows = buildScoreRows({ "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores);
    expect(rows.map((r) => r.horizon)).toEqual(["1w", "1m", "1y"]);
    expect(rows[0].hasData).toBe(false);
    expect(rows[0].verdict).toBe("Insufficient data");
    expect(rows[0].brier).toBe("—");
  });

  it("formats populated rows and an honest verdict near zero BSS", () => {
    const scores = {
      "1w": { n: 30, brier: 0.244, brier_base: 0.25, bss: 0.005, mape: 3.1, coverage: 0.58 },
      "1m": { n: 5, brier: 0.20, brier_base: 0.25, bss: 0.2, mape: 6.0, coverage: 0.6 },
      "1y": { n: 0 },
    } as Scores;
    const rows = buildScoreRows(scores);
    expect(rows[0].hasData).toBe(true);
    expect(rows[0].n).toBe(30);
    expect(rows[0].mape).toBe("3.1%");
    expect(rows[0].coverage).toBe("58%");
    expect(rows[0].verdict).toBe("≈ random walk (expected)");   // |bss| small
    expect(rows[1].verdict).toBe("Beating random walk");         // bss 0.2
    expect(rows[2].hasData).toBe(false);
  });
});

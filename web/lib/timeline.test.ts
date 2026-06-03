// lib/timeline.test.ts
import { describe, it, expect } from "vitest";
import { buildTimeline } from "@/lib/timeline";
import type { TimelineItem } from "@/lib/types";

const t = (p_up: number): TimelineItem => ({
  run_at: "t", p_up, central: 1, drift_adj_bps: 0, vol_mult: 1,
  confidence_label: "low", llm_applied: true, rationale: "r",
});

describe("buildTimeline", () => {
  it("flags a direction flip vs the next-older entry (items newest-first)", () => {
    const out = buildTimeline([t(0.55), t(0.45), t(0.46)]);
    expect(out[0].up).toBe(true);
    expect(out[0].flipped).toBe(true);    // up now, down on the older one
    expect(out[1].up).toBe(false);
    expect(out[1].flipped).toBe(false);   // down then down
    expect(out[2].flipped).toBe(false);   // oldest -> no comparison
  });
});

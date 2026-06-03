// components/MindTimeline.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MindTimeline } from "@/components/MindTimeline";
import type { TimelineItem } from "@/lib/types";

const item = (p_up: number, rationale: string): TimelineItem => ({
  run_at: "2026-06-03T20:00:00+00:00", p_up, central: 65000, drift_adj_bps: -15, vol_mult: 1.15,
  confidence_label: "low", llm_applied: true, rationale,
});

describe("MindTimeline", () => {
  it("renders entries and a flip badge when direction changes", () => {
    render(<MindTimeline timeline={[item(0.55, "now bullish"), item(0.45, "was bearish")]} />);
    expect(screen.getByText(/now bullish/)).toBeInTheDocument();
    expect(screen.getByText(/changed direction/i)).toBeInTheDocument();
  });
  it("shows an empty state", () => {
    render(<MindTimeline timeline={[]} />);
    expect(screen.getByText(/no history yet/i)).toBeInTheDocument();
  });
});

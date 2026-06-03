import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Page from "@/app/page";

vi.mock("@/lib/data", () => ({
  fetchSnapshots: vi.fn(async () => ({
    latest: {
      run_at: "2026-06-03T20:08:21+00:00", spot: 65260, llm_applied: true, model_id: "claude-sonnet-4-6",
      forecasts: [
        { horizon: "1w", target_at: "t", central: 65162, lower: 61589, upper: 68942, conf_level: 0.6, p_up: 0.49, confidence_label: "low", band_width_pct: 0.11, drift_adj_bps: -15, vol_mult: 1.15, rationale: "Extreme Fear drives caution" },
        { horizon: "1m", target_at: "t", central: 65064, lower: 57602, upper: 73493, conf_level: 0.6, p_up: 0.49, confidence_label: "low", band_width_pct: 0.24, drift_adj_bps: -30, vol_mult: 1.2, rationale: "x" },
        { horizon: "1y", target_at: "t", central: 65390, lower: 45086, upper: 94838, conf_level: 0.6, p_up: 0.5, confidence_label: "low", band_width_pct: 0.76, drift_adj_bps: 20, vol_mult: 1.05, rationale: "x" },
      ],
    },
    history: { "1w": [], "1m": [], "1y": [] },
    scores: { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } },
  })),
  fetchLiveSpot: vi.fn(async () => 65300),
}));

describe("Dashboard page", () => {
  it("renders the three horizon cards and the rationale after load", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getAllByText("1 Week").length).toBeGreaterThan(0));
    expect(screen.getAllByText("1 Month").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 Year").length).toBeGreaterThan(0);
    expect(screen.getByText(/Extreme Fear drives caution/)).toBeInTheDocument();
    expect(screen.getAllByText(/insufficient data/i).length).toBe(3);
  });
});

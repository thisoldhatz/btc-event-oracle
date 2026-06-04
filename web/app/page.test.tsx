import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Page from "@/app/page";

vi.mock("@/lib/data", () => {
  const latest = {
    run_at: "2026-06-03T20:08:21+00:00", spot: 65260, llm_applied: true, model_id: "claude-sonnet-4-6",
    forecasts: [
      { horizon: "1w", target_at: "2030-06-10T00:00:00Z", central: 65162, lower: 61589, upper: 68942, conf_level: 0.6, p_up: 0.49, confidence_label: "low", band_width_pct: 0.11, drift_adj_bps: -15, vol_mult: 1.15, rationale: "Extreme Fear drives caution" },
      { horizon: "1m", target_at: "2030-07-03T00:00:00Z", central: 65064, lower: 57602, upper: 73493, conf_level: 0.6, p_up: 0.49, confidence_label: "low", band_width_pct: 0.24, drift_adj_bps: -30, vol_mult: 1.2, rationale: "x" },
      { horizon: "1y", target_at: "2031-06-03T00:00:00Z", central: 65390, lower: 45086, upper: 94838, conf_level: 0.6, p_up: 0.5, confidence_label: "low", band_width_pct: 0.76, drift_adj_bps: 20, vol_mult: 1.05, rationale: "x" },
    ],
    signals: [{ source: "fng", signal: "fear_greed", value: 11, delta: -12, interpretation: "Extreme Fear", observed_at: "" }],
    news: [{ title: "Bitmine ETH loss widens", url: "https://x.com/a", source: "CoinDesk", published_at: "2026-06-03T20:00:00+00:00" }],
    regime: { label: "elevated", percentile: 0.7 },
    markets: [{ question: "Will Bitcoin be above $62,000 on June 4?", yes_prob: 0.58, end_date: "x" }],
  };
  const heavy = {
    history: { "1w": [], "1m": [], "1y": [] },
    scores: { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } },
    extras: { timeline: [{ run_at: "2026-06-03T20:00:00+00:00", p_up: 0.49, central: 65162, drift_adj_bps: -15, vol_mult: 1.15, confidence_label: "low", llm_applied: true, rationale: "Extreme Fear capitulation" }], results: [] },
  };
  return {
    fetchLatest: vi.fn(async () => latest),
    fetchHeavy: vi.fn(async () => heavy),
    fetchSnapshots: vi.fn(async () => ({ latest, ...heavy })),
    fetchLiveSpot: vi.fn(async () => 65300),
    fetchActualPrices: vi.fn(async () => []),
  };
});

describe("Dashboard page", () => {
  it("renders cards, signals, news, dial, timeline and LIVE after load", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getAllByText("1 Week").length).toBeGreaterThan(0));
    expect(screen.getByText(/Extreme Fear drives caution/)).toBeInTheDocument();
    expect(screen.getByText(/Bitmine ETH loss widens/)).toBeInTheDocument();
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
    expect(screen.getByText(/How the model changed its mind/i)).toBeInTheDocument();
    expect(screen.getByText(/Did it call it/i)).toBeInTheDocument();
    expect(screen.getAllByText(/insufficient data/i).length).toBe(3);
    expect(screen.getByText(/real-money markets imply/i)).toBeInTheDocument();
    expect(screen.getByText(/calibration & skill/i)).toBeInTheDocument();
    expect(screen.getByText(/your call vs\. the model/i)).toBeInTheDocument();
    expect(screen.getByText(/intervals modestly widened/i)).toBeInTheDocument();   // regime note
  });
});

// components/HorizonCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HorizonCard } from "@/components/HorizonCard";
import type { Forecast } from "@/lib/types";

const f: Forecast = {
  horizon: "1w", target_at: "2026-06-10T00:00:00+00:00", central: 65162, lower: 61589,
  upper: 68942, conf_level: 0.6, p_up: 0.491, confidence_label: "low",
  band_width_pct: 0.1127, drift_adj_bps: -15, vol_mult: 1.15, rationale: "x",
};

describe("HorizonCard", () => {
  it("shows the horizon label, central, range and P(up)", () => {
    render(<HorizonCard f={f} />);
    expect(screen.getByText("1 Week")).toBeInTheDocument();
    expect(screen.getByText("$65,162")).toBeInTheDocument();
    expect(screen.getByText(/\$61,589/)).toBeInTheDocument();
    expect(screen.getByText(/\$68,942/)).toBeInTheDocument();
    expect(screen.getByText("49%")).toBeInTheDocument();   // P(up)
    expect(screen.getByText(/low/i)).toBeInTheDocument();   // confidence chip
  });
});

// components/SignalsStrip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalsStrip } from "@/components/SignalsStrip";
import type { Signal } from "@/lib/types";

const signals: Signal[] = [
  { source: "fng", signal: "fear_greed", value: 11, delta: -12, interpretation: "Extreme Fear", observed_at: "" },
  { source: "funding", signal: "funding_rate", value: 0.0000814, delta: null, interpretation: "crowded long", observed_at: "" },
  { source: "oi", signal: "open_interest", value: 58472.86, delta: null, interpretation: "contracts", observed_at: "" },
];

describe("SignalsStrip", () => {
  it("renders a tile per signal with label + value", () => {
    render(<SignalsStrip signals={signals} />);
    expect(screen.getByText("Fear & Greed")).toBeInTheDocument();
    expect(screen.getByText("11/100")).toBeInTheDocument();
    expect(screen.getByText("+0.0081%")).toBeInTheDocument();
    expect(screen.getByText("58,473")).toBeInTheDocument();
  });
  it("shows an honest empty state when there are no signals", () => {
    render(<SignalsStrip signals={[]} />);
    expect(screen.getByText(/fills in as the feeds report/i)).toBeInTheDocument();
  });
});

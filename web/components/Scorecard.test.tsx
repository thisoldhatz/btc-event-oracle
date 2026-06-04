// components/Scorecard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Scorecard } from "@/components/Scorecard";
import type { Scores } from "@/lib/types";

describe("Scorecard", () => {
  it("renders 'Insufficient data' for empty horizons", () => {
    const scores = { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores;
    render(<Scorecard scores={scores} />);
    expect(screen.getAllByText(/insufficient data/i).length).toBe(3);
  });

  it("shows metrics and verdict for a populated horizon", () => {
    const scores = {
      "1w": { n: 30, brier: 0.244, brier_base: 0.25, bss: 0.2, mape: 3.1, coverage: 0.58 },
      "1m": { n: 0 }, "1y": { n: 0 },
    } as Scores;
    render(<Scorecard scores={scores} />);
    expect(screen.getByTitle(/beats random walk/i)).toBeInTheDocument();   // zero-axis skill bar
    expect(screen.getByText("3.1%")).toBeInTheDocument();                  // MAPE
  });
});

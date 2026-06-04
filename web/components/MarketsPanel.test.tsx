import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketsPanel } from "@/components/MarketsPanel";
import type { Market } from "@/lib/types";

describe("MarketsPanel", () => {
  it("renders markets with implied %", () => {
    const markets: Market[] = [{ question: "Will the price of Bitcoin be above $62,000 on June 4?", yes_prob: 0.585, end_date: "x" }];
    render(<MarketsPanel markets={markets} />);
    expect(screen.getByText(/above \$62,000/)).toBeInTheDocument();
    expect(screen.getByText("59%")).toBeInTheDocument();
  });
  it("shows empty state", () => {
    render(<MarketsPanel markets={[]} />);
    expect(screen.getByText(/no live markets/i)).toBeInTheDocument();
  });
});

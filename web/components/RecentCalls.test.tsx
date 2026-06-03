// components/RecentCalls.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentCalls } from "@/components/RecentCalls";
import type { ResultItem } from "@/lib/types";

describe("RecentCalls", () => {
  it("shows an empty state when nothing has matured", () => {
    render(<RecentCalls results={[]} />);
    expect(screen.getByText(/no calls have matured yet/i)).toBeInTheDocument();
  });
  it("renders a matured call with a hit/miss marker", () => {
    const results: ResultItem[] = [{
      horizon: "1w", run_at: "t", target_at: "2026-06-10T00:00:00Z", central: 100, lower: 90,
      upper: 110, p_up: 0.6, spot_at_issue: 95, realized_price: 105, up_outcome: 1, covered: true,
    }];
    render(<RecentCalls results={results} />);
    expect(screen.getByText(/1 Week/)).toBeInTheDocument();
    expect(screen.getByText(/✓/)).toBeInTheDocument();
  });
});

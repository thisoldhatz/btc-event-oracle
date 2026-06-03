// components/FearGreedDial.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FearGreedDial } from "@/components/FearGreedDial";
describe("FearGreedDial", () => {
  it("shows the value and an Extreme Fear label for low readings", () => {
    render(<FearGreedDial value={11} />);
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText(/extreme fear/i)).toBeInTheDocument();
  });
});

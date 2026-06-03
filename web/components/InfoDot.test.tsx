// components/InfoDot.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoDot } from "@/components/InfoDot";
describe("InfoDot", () => {
  it("exposes its explanation as a title/label", () => {
    render(<InfoDot text="chance the price is higher" />);
    const el = screen.getByLabelText("chance the price is higher");
    expect(el).toHaveAttribute("title", "chance the price is higher");
  });
});

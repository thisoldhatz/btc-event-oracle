// components/InfoDot.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InfoDot } from "@/components/InfoDot";

describe("InfoDot", () => {
  it("reveals its explanation via an accessible, keyboard-reachable button", () => {
    render(<InfoDot text="chance the price is higher" />);
    const btn = screen.getByRole("button", { name: /explain/i });
    expect(screen.queryByText("chance the price is higher")).toBeNull();   // hidden until opened
    fireEvent.click(btn);
    expect(screen.getByRole("tooltip")).toHaveTextContent("chance the price is higher");
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});

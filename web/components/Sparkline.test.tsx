// components/Sparkline.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "@/components/Sparkline";
describe("Sparkline", () => {
  it("renders an svg polyline for >=2 points", () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} />);
    expect(container.querySelector("polyline")).not.toBeNull();
  });
  it("renders nothing for <2 points", () => {
    const { container } = render(<Sparkline points={[1]} />);
    expect(container.firstChild).toBeNull();
  });
});

// components/SkillPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillPanel } from "@/components/SkillPanel";
import type { Scores } from "@/lib/types";

describe("SkillPanel", () => {
  it("shows insufficient-data state", () => {
    render(<SkillPanel scores={{ "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores} />);
    expect(screen.getAllByText(/not enough resolved forecasts/i).length).toBeGreaterThan(0);
  });
});

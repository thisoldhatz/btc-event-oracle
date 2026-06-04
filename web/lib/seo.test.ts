import { describe, it, expect } from "vitest";
import { getSeo, getScores, SIGNALS, SITE } from "@/lib/seo";

describe("seo data layer", () => {
  it("reads the committed seo fixture", () => {
    const s = getSeo();
    expect(s.as_of).toBeTruthy();
    expect(s.signals.fear_greed.length).toBeGreaterThan(0);
    expect(s.recaps[0].week).toBe("2026-W23");
  });
  it("exposes the slug->signal map and the absolute site base", () => {
    expect(SIGNALS["fear-greed"].key).toBe("fear_greed");
    expect(Object.keys(SIGNALS)).toHaveLength(5);
    expect(SITE).toContain("vadym.online/btc");
  });
  it("reads scores (or null) without throwing", () => {
    expect(() => getScores()).not.toThrow();
  });
});

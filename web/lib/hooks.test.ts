import { describe, it, expect } from "vitest";
import { priceDirection } from "@/lib/hooks";

describe("priceDirection", () => {
  it("detects up/down/flat", () => {
    expect(priceDirection(100, 101)).toBe("up");
    expect(priceDirection(100, 99)).toBe("down");
    expect(priceDirection(100, 100)).toBe("flat");
  });
  it("is flat when there is no previous price", () => {
    expect(priceDirection(null, 100)).toBe("flat");
  });
});

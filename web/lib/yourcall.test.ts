import { describe, it, expect } from "vitest";
import { priceAt, resolveCall, type Call } from "@/lib/yourcall";

const prices = [{ t: 100, price: 10 }, { t: 200, price: 20 }, { t: 300, price: 30 }];

describe("yourcall", () => {
  it("priceAt returns the first price at/after the target", () => {
    expect(priceAt(prices, 150)).toBe(20);
    expect(priceAt(prices, 300)).toBe(30);
    expect(priceAt(prices, 999)).toBeNull();   // not matured in data
  });
  it("resolveCall scores user + model once the target price is available", () => {
    const call: Call = { id: "a", createdAt: 0, targetAt: 150, spotAtPick: 15, userUp: true, modelPup: 0.7 };
    const r = resolveCall(call, prices);       // price at 150 -> 20 > 15 => up
    expect(r.resolved).toBe(true);
    expect(r.actualUp).toBe(true);
    expect(r.userRight).toBe(true);            // user said up, was up
    expect(r.modelRight).toBe(true);           // model p_up 0.7 (lean up), was up
  });
  it("resolveCall stays pending without a target price", () => {
    const call: Call = { id: "b", createdAt: 0, targetAt: 999, spotAtPick: 15, userUp: false, modelPup: 0.4 };
    expect(resolveCall(call, prices).resolved).toBe(false);
  });
});

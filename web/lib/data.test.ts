import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSnapshots, fetchLiveSpot, fetchActualPrices } from "@/lib/data";

afterEach(() => vi.restoreAllMocks());

describe("data", () => {
  it("fetches latest/history/scores/extras", async () => {
    const bodies: Record<string, unknown> = {
      "/data/latest.json": { run_at: "t", spot: 65000, llm_applied: true, model_id: "m", forecasts: [] },
      "/data/history.json": { "1w": [], "1m": [], "1y": [] },
      "/data/scores.json": { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } },
      "/data/extras.json": { timeline: [{ run_at: "t", p_up: 0.5, central: 1, drift_adj_bps: 0, vol_mult: 1, confidence_label: "low", llm_applied: true, rationale: "x" }], results: [] },
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const key = Object.keys(bodies).find((k) => url.startsWith(k))!;
      return { ok: true, json: async () => bodies[key] } as Response;
    }));
    const { latest, scores, extras } = await fetchSnapshots();
    expect(latest.spot).toBe(65000);
    expect(scores["1w"].n).toBe(0);
    expect(extras.timeline).toHaveLength(1);
  });

  it("returns null spot and [] prices when CoinGecko fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    expect(await fetchLiveSpot()).toBeNull();
    expect(await fetchActualPrices()).toEqual([]);
  });

  it("maps CoinGecko prices to {t, price}", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ prices: [[1000, 65], [2000, 66]] }) } as Response)));
    const p = await fetchActualPrices(7);
    expect(p).toEqual([{ t: 1000, price: 65 }, { t: 2000, price: 66 }]);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSnapshots, fetchLiveSpot } from "@/lib/data";

afterEach(() => vi.restoreAllMocks());

describe("data", () => {
  it("fetches and returns the three snapshots", async () => {
    const bodies: Record<string, unknown> = {
      "/data/latest.json": { run_at: "t", spot: 65000, llm_applied: true, model_id: "m", forecasts: [] },
      "/data/history.json": { "1w": [], "1m": [], "1y": [] },
      "/data/scores.json": { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } },
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const key = Object.keys(bodies).find((k) => url.startsWith(k))!;
      return { ok: true, json: async () => bodies[key] } as Response;
    }));
    const { latest, history, scores } = await fetchSnapshots();
    expect(latest.spot).toBe(65000);
    expect(scores["1w"].n).toBe(0);
    expect(Array.isArray(history["1w"])).toBe(true);
  });

  it("returns null spot when CoinGecko fails (never throws)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect(await fetchLiveSpot()).toBeNull();
  });
});

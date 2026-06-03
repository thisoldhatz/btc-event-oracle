import type { Latest, History, Scores, Extras } from "./types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}?t=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return (await r.json()) as T;
}

export async function fetchSnapshots(): Promise<{
  latest: Latest; history: History; scores: Scores; extras: Extras;
}> {
  const [latest, history, scores, extras] = await Promise.all([
    getJson<Latest>("/data/latest.json"),
    getJson<History>("/data/history.json"),
    getJson<Scores>("/data/scores.json"),
    getJson<Extras>("/data/extras.json"),
  ]);
  return { latest, history, scores, extras };
}

export async function fetchLiveSpot(): Promise<number | null> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    const j = await r.json();
    return j?.bitcoin?.usd ?? null;
  } catch {
    return null;
  }
}

export async function fetchActualPrices(days = 30): Promise<{ t: number; price: number }[]> {
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
    );
    const j = await r.json();
    return ((j?.prices ?? []) as [number, number][]).map((p) => ({ t: p[0], price: p[1] }));
  } catch {
    return [];
  }
}

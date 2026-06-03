import type { Latest, History, Scores } from "./types";

// When the site is served under a sub-path (e.g. /btc), fetch() is NOT basePath-aware,
// so data lives at `${BASE}/data/*.json`. Empty in tests/local-root, "/btc" in production.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}?t=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return (await r.json()) as T;
}

export async function fetchSnapshots(): Promise<{ latest: Latest; history: History; scores: Scores }> {
  const [latest, history, scores] = await Promise.all([
    getJson<Latest>("/data/latest.json"),
    getJson<History>("/data/history.json"),
    getJson<Scores>("/data/scores.json"),
  ]);
  return { latest, history, scores };
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

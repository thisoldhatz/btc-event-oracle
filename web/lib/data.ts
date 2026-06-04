import type { Latest, History, Scores, Extras } from "./types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Fetch one JSON snapshot from the host.
 *
 * `cache: "no-cache"` revalidates with a conditional request (cheap 304s while
 * the hourly file is unchanged) instead of the old `no-store`, which forced an
 * un-cacheable full download on every poll. We also dropped the per-request
 * `?t=${Date.now()}` cache-buster: that stream of unique URLs, polled every
 * 60s, looked like scraping to the host's firewall and got visitor IPs banned.
 *
 * When the host firewall blocks the device it serves its HTML "Unauthorized
 * Access" page with HTTP 200 — so `res.ok` is true but the body is HTML. We
 * detect that and throw a clear, recognizable `BLOCKED:` error instead of the
 * cryptic `Unexpected token '<'` JSON-parse failure a visitor would otherwise
 * see, so the UI can explain what's happening.
 */
async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  const ct = r.headers?.get?.("content-type") ?? "";
  if (ct && !ct.includes("json")) {
    throw new Error(`BLOCKED: ${path} returned "${ct}" — the host firewall may be blocking this device.`);
  }
  try {
    return (await r.json()) as T;
  } catch {
    throw new Error(`BLOCKED: ${path} returned a non-JSON response — the host firewall may be blocking this device.`);
  }
}

/** The small, frequently-changing snapshot — the only file polled on each tick. */
export async function fetchLatest(): Promise<Latest> {
  return getJson<Latest>("/data/latest.json");
}

/** The heavier snapshots — refetched only when a new hourly run appears. */
export async function fetchHeavy(): Promise<{ history: History; scores: Scores; extras: Extras }> {
  const [history, scores, extras] = await Promise.all([
    getJson<History>("/data/history.json"),
    getJson<Scores>("/data/scores.json"),
    getJson<Extras>("/data/extras.json"),
  ]);
  return { history, scores, extras };
}

export async function fetchSnapshots(): Promise<{
  latest: Latest; history: History; scores: Scores; extras: Extras;
}> {
  const [latest, heavy] = await Promise.all([fetchLatest(), fetchHeavy()]);
  return { latest, ...heavy };
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

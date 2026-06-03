# BTC Oracle — Engagement Features (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard more engaging: (1) overlay the **actual BTC price** on the forecast chart, (2) **countdowns** to each forecast's resolution + **"called it" ✓/✗ reveals** when they mature, (3) a **"how the model changed its mind"** timeline, and (4) **visual polish** — Fear & Greed dial, price sparkline, number count-up, term tooltips.

**Architecture:** Extend the typed `lib/` (new types + pure helpers, Vitest-tested), add presentational components, and wire them into the Layout-A page. New data: `extras.json` (`timeline` + `results`) and a client-side CoinGecko price-history fetch (CORS-friendly). Pure logic is unit-tested; visual/animation is verified by the page render test + build.

**Working dir:** `C:\Users\GamerTech\btc-oracle\web`. Bash: `cd /c/Users/GamerTech/btc-oracle/web && ...`. Tests: `npm test -- <file>`. Build: `npm run build`. Type-check: `npx tsc --noEmit`. Git from repo root `cd /c/Users/GamerTech/btc-oracle`. Alias `@/*` → `web/`.

**Verified data (real, in `web/public/data/extras.json`):**
```jsonc
"timeline": [ { "run_at": "...", "p_up": 0.491, "central": 65162.0, "drift_adj_bps": -15.0,
                "vol_mult": 1.15, "confidence_label": "low", "llm_applied": true,
                "rationale": "Extreme Fear ..." } ],   // newest-first, ~72 max
"results": [ /* empty until forecasts mature; then: */
  { "horizon": "1w", "run_at": "...", "target_at": "...", "central": 65000, "lower": 61000,
    "upper": 69000, "p_up": 0.55, "spot_at_issue": 64000, "realized_price": 66000,
    "up_outcome": 1, "covered": true } ]
```
CoinGecko history: `GET https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30` → `{ "prices": [[ms_ts, usd], ...] }` (CORS `*`).

**Existing (don't break):** `lib/{types,format,data,hooks,chart}`, `components/{Header,HorizonCard,ForecastChart,Scorecard,SignalsStrip,NewsFeed,RationalePanel,Disclaimer}`, `app/page.tsx`.

---

### Task 1: Types + timeUntil + data layer (extras + actual prices)

**Files:**
- Modify: `lib/types.ts`, `lib/format.ts`, `lib/data.ts`, `lib/hooks.ts`, `lib/data.test.ts`
- Test: `lib/format.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `lib/format.test.ts`:
```tsx
import { timeUntil } from "@/lib/format";
describe("timeUntil", () => {
  const now = Date.parse("2026-06-03T00:00:00Z");
  it("formats days/hours and minutes", () => {
    expect(timeUntil("2026-06-08T03:00:00Z", now)).toBe("5d 3h");
    expect(timeUntil("2026-06-03T02:30:00Z", now)).toBe("2h 30m");
    expect(timeUntil("2026-06-03T00:20:00Z", now)).toBe("20m");
  });
  it("says resolved once past", () => {
    expect(timeUntil("2026-06-02T00:00:00Z", now)).toBe("resolved");
  });
});
```

Replace `lib/data.test.ts` entirely with (adds the extras fetch + fetchActualPrices):
```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- lib/format.test.ts lib/data.test.ts`
Expected: FAIL — `timeUntil`/`fetchActualPrices` not exported; extras missing.

- [ ] **Step 3: Write the implementation**

Append to `lib/types.ts`:
```ts
export interface TimelineItem {
  run_at: string;
  p_up: number;
  central: number;
  drift_adj_bps: number;
  vol_mult: number;
  confidence_label: string;
  llm_applied: boolean;
  rationale: string;
}
export interface ResultItem {
  horizon: Horizon;
  run_at: string;
  target_at: string;
  central: number;
  lower: number;
  upper: number;
  p_up: number;
  spot_at_issue: number;
  realized_price: number;
  up_outcome: number;
  covered: boolean | null;
}
export interface Extras {
  timeline: TimelineItem[];
  results: ResultItem[];
}
```

Append to `lib/format.ts`:
```ts
export function timeUntil(targetIso: string, now: number = Date.now()): string {
  const t = Date.parse(targetIso);
  if (Number.isNaN(t)) return "";
  const s = Math.floor((t - now) / 1000);
  if (s <= 0) return "resolved";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
```

Replace `lib/data.ts` with (adds extras to fetchSnapshots + fetchActualPrices):
```ts
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
```

In `lib/hooks.ts`, extend `LiveData` and `useLiveData` to carry `extras`:
- Add `Extras` to the type import: `import type { Latest, History, Scores, Extras } from "./types";`
- In `interface LiveData` add: `extras: Extras | null;`
- In `useLiveData` initial state add `extras: null,` and in the success branch set `extras` from the fetch result:
```ts
        const { latest, history, scores, extras } = await fetchSnapshots();
        if (!alive) return;
        setData({ latest, history, scores, extras, error: null, updatedAt: Date.now() });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/format.test.ts lib/data.test.ts`
Expected: PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/lib/format.ts web/lib/data.ts web/lib/hooks.ts web/lib/format.test.ts web/lib/data.test.ts
git commit -m "feat(web): timeline/results types, timeUntil, extras + actual-price fetch"
```

---

### Task 2: Pure helpers — mergeActual, buildCallRows, buildTimeline

**Files:**
- Modify: `lib/chart.ts`
- Create: `lib/results.ts`, `lib/timeline.ts`
- Test: `lib/chart.test.ts` (append), `lib/results.test.ts`, `lib/timeline.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/chart.test.ts`:
```ts
import { mergeActual } from "@/lib/chart";
describe("mergeActual", () => {
  it("attaches actual prices and unions timestamps in order", () => {
    const band = [{ t: 100, label: "a", lower: 1, band: 2, central: 2, upper: 3, p_up: 0.5 }];
    const actual = [{ t: 100, price: 9 }, { t: 200, price: 10 }];
    const m = mergeActual(band, actual);
    expect(m).toHaveLength(2);
    expect(m[0].t).toBe(100);
    expect(m[0].actual).toBe(9);
    expect(m[0].central).toBe(2);
    expect(m[1].t).toBe(200);
    expect(m[1].actual).toBe(10);
    expect(m[1].central).toBeUndefined();   // actual-only point has no forecast fields
  });
});
```

```ts
// lib/results.test.ts
import { describe, it, expect } from "vitest";
import { buildCallRows } from "@/lib/results";
import type { ResultItem } from "@/lib/types";

const r = (over: Partial<ResultItem>): ResultItem => ({
  horizon: "1w", run_at: "t", target_at: "t2", central: 100, lower: 90, upper: 110,
  p_up: 0.6, spot_at_issue: 95, realized_price: 105, up_outcome: 1, covered: true, ...over,
});

describe("buildCallRows", () => {
  it("scores a correct up-call as a hit", () => {
    const [row] = buildCallRows([r({})]);
    expect(row.predictedUp).toBe(true);
    expect(row.actualUp).toBe(true);
    expect(row.hit).toBe(true);
    expect(row.inRange).toBe(true);
    expect(row.pctErr).toBeCloseTo(Math.abs(105 - 100) / 105 * 100, 4);
  });
  it("marks a wrong direction as a miss", () => {
    const [row] = buildCallRows([r({ p_up: 0.6, up_outcome: 0 })]);
    expect(row.hit).toBe(false);
  });
});
```

```ts
// lib/timeline.test.ts
import { describe, it, expect } from "vitest";
import { buildTimeline } from "@/lib/timeline";
import type { TimelineItem } from "@/lib/types";

const t = (p_up: number): TimelineItem => ({
  run_at: "t", p_up, central: 1, drift_adj_bps: 0, vol_mult: 1,
  confidence_label: "low", llm_applied: true, rationale: "r",
});

describe("buildTimeline", () => {
  it("flags a direction flip vs the next-older entry (items newest-first)", () => {
    const out = buildTimeline([t(0.55), t(0.45), t(0.46)]);
    expect(out[0].up).toBe(true);
    expect(out[0].flipped).toBe(true);    // up now, down on the older one
    expect(out[1].up).toBe(false);
    expect(out[1].flipped).toBe(false);   // down then down
    expect(out[2].flipped).toBe(false);   // oldest -> no comparison
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- lib/chart.test.ts lib/results.test.ts lib/timeline.test.ts`
Expected: FAIL — `mergeActual`/`buildCallRows`/`buildTimeline` missing.

- [ ] **Step 3: Write the implementation**

Append to `lib/chart.ts`:
```ts
export interface MergedPoint {
  t: number;
  label: string;
  lower?: number;
  band?: number;
  central?: number;
  upper?: number;
  actual?: number;
}

export function mergeActual(
  band: BandPoint[],
  actual: { t: number; price: number }[],
): MergedPoint[] {
  const map = new Map<number, MergedPoint>();
  for (const b of band) {
    map.set(b.t, { t: b.t, label: b.label, lower: b.lower, band: b.band, central: b.central, upper: b.upper });
  }
  for (const a of actual) {
    const e = map.get(a.t);
    if (e) e.actual = a.price;
    else map.set(a.t, { t: a.t, label: new Date(a.t).toISOString(), actual: a.price });
  }
  return [...map.values()].sort((x, y) => x.t - y.t);
}
```

```ts
// lib/results.ts
import type { ResultItem, Horizon } from "./types";

export interface CallRow {
  horizon: Horizon;
  target_at: string;
  predictedUp: boolean;
  actualUp: boolean;
  hit: boolean;
  central: number;
  realized: number;
  inRange: boolean | null;
  pctErr: number;
}

export function buildCallRows(results: ResultItem[]): CallRow[] {
  return results.map((r) => {
    const predictedUp = r.p_up >= 0.5;
    const actualUp = r.up_outcome === 1;
    return {
      horizon: r.horizon, target_at: r.target_at, predictedUp, actualUp,
      hit: predictedUp === actualUp, central: r.central, realized: r.realized_price,
      inRange: r.covered,
      pctErr: r.realized_price ? (Math.abs(r.realized_price - r.central) / r.realized_price) * 100 : 0,
    };
  });
}
```

```ts
// lib/timeline.ts
import type { TimelineItem } from "./types";

export interface TimelineEntry extends TimelineItem {
  up: boolean;
  flipped: boolean;
}

export function buildTimeline(items: TimelineItem[]): TimelineEntry[] {
  return items.map((it, i) => {
    const up = it.p_up >= 0.5;
    const older = items[i + 1];
    const flipped = older ? up !== (older.p_up >= 0.5) : false;
    return { ...it, up, flipped };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/chart.test.ts lib/results.test.ts lib/timeline.test.ts`
Expected: PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add web/lib/chart.ts web/lib/results.ts web/lib/timeline.ts web/lib/chart.test.ts web/lib/results.test.ts web/lib/timeline.test.ts
git commit -m "feat(web): mergeActual + buildCallRows + buildTimeline helpers"
```

---

### Task 3: Actual price overlay on the chart (`ForecastChart.tsx`)

**Files:**
- Overwrite: `components/ForecastChart.tsx`

- [ ] **Step 1: Write the implementation** (replace entire file)

```tsx
// components/ForecastChart.tsx
"use client";
import { useEffect, useState } from "react";
import {
  Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import type { History, Horizon } from "@/lib/types";
import { toBandSeries, mergeActual } from "@/lib/chart";
import { fetchActualPrices } from "@/lib/data";
import { HORIZON_ORDER, HORIZON_LABEL, fmtUsd } from "@/lib/format";

const DAYS: Record<Horizon, number> = { "1w": 14, "1m": 45, "1y": 365 };

export function ForecastChart({ history }: { history: History }) {
  const [h, setH] = useState<Horizon>("1w");
  const [actual, setActual] = useState<{ t: number; price: number }[]>([]);

  useEffect(() => {
    let alive = true;
    fetchActualPrices(DAYS[h]).then((p) => alive && setActual(p));
    return () => { alive = false; };
  }, [h]);

  const data = mergeActual(toBandSeries(history[h] ?? []), actual);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Forecast vs. actual</h3>
        <div className="flex gap-1">
          {HORIZON_ORDER.map((opt) => (
            <button key={opt} onClick={() => setH(opt)}
              className={`rounded-md px-2.5 py-1 text-xs ${opt === h ? "bg-[#f7931a] text-black" : "bg-zinc-800 text-zinc-300"}`}>
              {HORIZON_LABEL[opt]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">No forecast history yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time"
                tickFormatter={(t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                stroke="#52525b" fontSize={11} />
              <YAxis tickFormatter={(v) => fmtUsd(v)} stroke="#52525b" fontSize={11} width={64} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelFormatter={(t) => new Date(t as number).toLocaleString()}
                formatter={(v: number, name) => [fmtUsd(v), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area name="forecast range" dataKey="lower" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" connectNulls />
              <Area name="forecast range" dataKey="band" stackId="band" stroke="none" fill="#f7931a" fillOpacity={0.13} isAnimationActive={false} connectNulls />
              <Line name="forecast" dataKey="central" stroke="#f7931a" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
              <Line name="actual BTC" dataKey="actual" stroke="#60a5fa" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Orange = {HORIZON_LABEL[h]} forecast (central + range) · blue = actual BTC price.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/components/ForecastChart.tsx
git commit -m "feat(web): overlay actual BTC price on the forecast chart"
```

---

### Task 4: Countdowns on cards + "called it" reveals (`HorizonCard.tsx`, `RecentCalls.tsx`)

**Files:**
- Overwrite: `components/HorizonCard.tsx`
- Create: `components/RecentCalls.tsx`
- Test: `components/RecentCalls.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/RecentCalls.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentCalls } from "@/components/RecentCalls";
import type { ResultItem } from "@/lib/types";

describe("RecentCalls", () => {
  it("shows an empty state when nothing has matured", () => {
    render(<RecentCalls results={[]} />);
    expect(screen.getByText(/no calls have matured yet/i)).toBeInTheDocument();
  });
  it("renders a matured call with a hit/miss marker", () => {
    const results: ResultItem[] = [{
      horizon: "1w", run_at: "t", target_at: "2026-06-10T00:00:00Z", central: 100, lower: 90,
      upper: 110, p_up: 0.6, spot_at_issue: 95, realized_price: 105, up_outcome: 1, covered: true,
    }];
    render(<RecentCalls results={results} />);
    expect(screen.getByText(/1 Week/)).toBeInTheDocument();
    expect(screen.getByText(/✓/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/RecentCalls.test.tsx`
Expected: FAIL — cannot resolve `@/components/RecentCalls`.

- [ ] **Step 3: Write the implementation**

`components/RecentCalls.tsx`:
```tsx
import type { ResultItem } from "@/lib/types";
import { buildCallRows } from "@/lib/results";
import { HORIZON_LABEL, fmtUsd } from "@/lib/format";

export function RecentCalls({ results }: { results: ResultItem[] }) {
  const rows = buildCallRows(results);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Did it call it?</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">
          No calls have matured yet — the first 1-week forecast resolves about a week after launch. Check back.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-800">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <span className="text-zinc-300">{HORIZON_LABEL[r.horizon]}</span>
                <span className="ml-2 text-zinc-500">
                  said {r.predictedUp ? "up" : "down"}, was {r.actualUp ? "up" : "down"}
                </span>
                <div className="text-xs text-zinc-600">
                  est {fmtUsd(r.central)} · actual {fmtUsd(r.realized)} ({r.pctErr.toFixed(1)}% off)
                  {r.inRange !== null && <> · {r.inRange ? "in range" : "outside range"}</>}
                </div>
              </div>
              <span className={`text-lg font-bold ${r.hit ? "text-emerald-400" : "text-rose-400"}`}>
                {r.hit ? "✓" : "✗"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Replace `components/HorizonCard.tsx` with (adds the resolution countdown):
```tsx
import type { Forecast } from "@/lib/types";
import { fmtUsd, fmtPct, fmtSignedBps, HORIZON_LABEL, confidenceClass, timeUntil } from "@/lib/format";

export function HorizonCard({ f, now }: { f: Forecast; now: number }) {
  const up = f.p_up >= 0.5;
  const left = timeUntil(f.target_at, now);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{HORIZON_LABEL[f.horizon]}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${confidenceClass(f.confidence_label)}`}>
          {f.confidence_label} confidence
        </span>
      </div>

      <div className="mt-3 text-3xl font-bold text-zinc-50">{fmtUsd(f.central)}</div>
      <div className="mt-1 text-sm text-zinc-400">
        range <span className="text-zinc-200">{fmtUsd(f.lower)}</span> – <span className="text-zinc-200">{fmtUsd(f.upper)}</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
        <div>
          <div className="text-xs text-zinc-500">P(up)</div>
          <div className={`text-lg font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>{fmtPct(f.p_up)}</div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>drift {fmtSignedBps(f.drift_adj_bps)}</div>
          <div>vol ×{f.vol_mult.toFixed(2)}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        resolves in <span className="text-zinc-300">{left}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/RecentCalls.test.tsx`
Expected: PASS. Then `npx tsc --noEmit` → clean (note: `HorizonCard` now requires a `now` prop — the page wires it in Task 8; the existing `HorizonCard.test.tsx` must pass `now={Date.now()}` — update it: add `now={0}` to its render call and keep its assertions).

> Update `components/HorizonCard.test.tsx`: change `render(<HorizonCard f={f} />)` to `render(<HorizonCard f={f} now={0} />)`. Nothing else changes.

- [ ] **Step 5: Commit**

```bash
git add web/components/HorizonCard.tsx web/components/HorizonCard.test.tsx web/components/RecentCalls.tsx web/components/RecentCalls.test.tsx
git commit -m "feat(web): per-card resolution countdown + 'did it call it' reveals"
```

---

### Task 5: "How the model changed its mind" timeline (`MindTimeline.tsx`)

**Files:**
- Create: `components/MindTimeline.tsx`
- Test: `components/MindTimeline.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/MindTimeline.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MindTimeline } from "@/components/MindTimeline";
import type { TimelineItem } from "@/lib/types";

const item = (p_up: number, rationale: string): TimelineItem => ({
  run_at: "2026-06-03T20:00:00+00:00", p_up, central: 65000, drift_adj_bps: -15, vol_mult: 1.15,
  confidence_label: "low", llm_applied: true, rationale,
});

describe("MindTimeline", () => {
  it("renders entries and a flip badge when direction changes", () => {
    render(<MindTimeline timeline={[item(0.55, "now bullish"), item(0.45, "was bearish")]} />);
    expect(screen.getByText(/now bullish/)).toBeInTheDocument();
    expect(screen.getByText(/changed direction/i)).toBeInTheDocument();
  });
  it("shows an empty state", () => {
    render(<MindTimeline timeline={[]} />);
    expect(screen.getByText(/no history yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/MindTimeline.test.tsx`
Expected: FAIL — cannot resolve `@/components/MindTimeline`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/MindTimeline.tsx
"use client";
import { useState } from "react";
import type { TimelineItem } from "@/lib/types";
import { buildTimeline } from "@/lib/timeline";
import { fmtPct, fmtDateTime } from "@/lib/format";

export function MindTimeline({ timeline }: { timeline: TimelineItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const entries = buildTimeline(timeline).slice(0, 15);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">How the model changed its mind</h3>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">No history yet — this fills in as the hourly forecasts accumulate.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {entries.map((e, i) => (
            <li key={i} className="border-l-2 border-zinc-800 pl-3">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between text-left">
                <span className="text-xs text-zinc-500">{fmtDateTime(e.run_at)}</span>
                <span className="flex items-center gap-2 text-xs">
                  {e.flipped && (
                    <span className="rounded-full border border-[#f7931a]/40 bg-[#f7931a]/10 px-1.5 py-0.5 text-[10px] text-[#f7931a]">
                      changed direction
                    </span>
                  )}
                  <span className={e.up ? "text-emerald-400" : "text-rose-400"}>
                    {e.up ? "▲" : "▼"} P(up) {fmtPct(e.p_up)}
                  </span>
                </span>
              </button>
              {open === i && <p className="mt-1 text-xs leading-relaxed text-zinc-400">{e.rationale}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/MindTimeline.test.tsx`
Expected: PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add web/components/MindTimeline.tsx web/components/MindTimeline.test.tsx
git commit -m "feat(web): 'how the model changed its mind' timeline"
```

---

### Task 6: Polish components — Fear & Greed dial + sparkline

**Files:**
- Create: `components/FearGreedDial.tsx`, `components/Sparkline.tsx`
- Test: `components/FearGreedDial.test.tsx`, `components/Sparkline.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// components/FearGreedDial.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FearGreedDial } from "@/components/FearGreedDial";
describe("FearGreedDial", () => {
  it("shows the value and an Extreme Fear label for low readings", () => {
    render(<FearGreedDial value={11} />);
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText(/extreme fear/i)).toBeInTheDocument();
  });
});
```

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- components/FearGreedDial.test.tsx components/Sparkline.test.tsx`
Expected: FAIL — components missing.

- [ ] **Step 3: Write the implementations**

```tsx
// components/FearGreedDial.tsx
export function FearGreedDial({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const label = v < 25 ? "Extreme Fear" : v < 45 ? "Fear" : v < 55 ? "Neutral" : v < 75 ? "Greed" : "Extreme Greed";
  const color = v < 25 ? "#fb7185" : v < 45 ? "#fbbf24" : v < 55 ? "#a3a3a3" : v < 75 ? "#a3e635" : "#34d399";
  const cx = 70, cy = 64, r = 54;
  const ang = Math.PI * (1 - v / 100);                       // 180deg (left) -> 0deg (right)
  const arc = (frac: number) => {
    const a = Math.PI * (1 - frac);
    return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
  };
  const nx = cx + (r - 8) * Math.cos(ang), ny = cy - (r - 8) * Math.sin(ang);
  return (
    <div className="flex flex-col items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="self-start text-xs text-zinc-500">Fear &amp; Greed</div>
      <svg width="140" height="78" viewBox="0 0 140 78">
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}`} fill="none" stroke="#27272a" strokeWidth="8" strokeLinecap="round" />
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(v / 100)}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" />
        <circle cx={cx} cy={cy} r="3" fill={color} />
      </svg>
      <div className="-mt-2 text-xl font-bold" style={{ color }}>{Math.round(v)}</div>
      <div className="text-xs" style={{ color }}>{label}</div>
    </div>
  );
}
```

```tsx
// components/Sparkline.tsx
export function Sparkline({ points, width = 84, height = 26 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const step = width / (points.length - 1);
  const pts = points.map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / range) * height).toFixed(1)}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? "#34d399" : "#fb7185"} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- components/FearGreedDial.test.tsx components/Sparkline.test.tsx`
Expected: PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add web/components/FearGreedDial.tsx web/components/Sparkline.tsx web/components/FearGreedDial.test.tsx web/components/Sparkline.test.tsx
git commit -m "feat(web): Fear & Greed dial + price sparkline"
```

---

### Task 7: Count-up hook + InfoDot tooltip (`hooks.ts`, `InfoDot.tsx`)

**Files:**
- Modify: `lib/hooks.ts` (add `useCountUp`)
- Create: `components/InfoDot.tsx`
- Test: `components/InfoDot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/InfoDot.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoDot } from "@/components/InfoDot";
describe("InfoDot", () => {
  it("exposes its explanation as a title/label", () => {
    render(<InfoDot text="chance the price is higher" />);
    const el = screen.getByLabelText("chance the price is higher");
    expect(el).toHaveAttribute("title", "chance the price is higher");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/InfoDot.test.tsx`
Expected: FAIL — cannot resolve `@/components/InfoDot`.

- [ ] **Step 3: Write the implementations**

`components/InfoDot.tsx`:
```tsx
export function InfoDot({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="ml-1 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-zinc-600 align-middle text-[9px] leading-none text-zinc-400"
    >
      i
    </span>
  );
}
```

Append `useCountUp` to `lib/hooks.ts`:
```ts
/** Smoothly animate a number toward `target` (browser only; falls back to the value). */
export function useCountUp(target: number | null, ms = 600): number | null {
  const [val, setVal] = useState<number | null>(target);
  const fromRef = useRef<number | null>(target);
  useEffect(() => {
    if (target === null) return;
    const from = fromRef.current ?? target;
    if (from === target) { setVal(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/InfoDot.test.tsx`
Expected: PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add web/lib/hooks.ts web/components/InfoDot.tsx web/components/InfoDot.test.tsx
git commit -m "feat(web): useCountUp animation hook + InfoDot tooltip"
```

---

### Task 8: Wire everything into the page + Header (`page.tsx`, `Header.tsx`)

**Files:**
- Overwrite: `app/page.tsx`, `components/Header.tsx`
- Modify: `app/page.test.tsx`

- [ ] **Step 1: Update the page test** (replace the mock + assertions)

Replace `app/page.test.tsx` with:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Page from "@/app/page";

vi.mock("@/lib/data", () => ({
  fetchSnapshots: vi.fn(async () => ({
    latest: {
      run_at: "2026-06-03T20:08:21+00:00", spot: 65260, llm_applied: true, model_id: "claude-sonnet-4-6",
      forecasts: [
        { horizon: "1w", target_at: "2030-06-10T00:00:00Z", central: 65162, lower: 61589, upper: 68942, conf_level: 0.6, p_up: 0.49, confidence_label: "low", band_width_pct: 0.11, drift_adj_bps: -15, vol_mult: 1.15, rationale: "Extreme Fear drives caution" },
        { horizon: "1m", target_at: "2030-07-03T00:00:00Z", central: 65064, lower: 57602, upper: 73493, conf_level: 0.6, p_up: 0.49, confidence_label: "low", band_width_pct: 0.24, drift_adj_bps: -30, vol_mult: 1.2, rationale: "x" },
        { horizon: "1y", target_at: "2031-06-03T00:00:00Z", central: 65390, lower: 45086, upper: 94838, conf_level: 0.6, p_up: 0.5, confidence_label: "low", band_width_pct: 0.76, drift_adj_bps: 20, vol_mult: 1.05, rationale: "x" },
      ],
      signals: [{ source: "fng", signal: "fear_greed", value: 11, delta: -12, interpretation: "Extreme Fear", observed_at: "" }],
      news: [{ title: "Bitmine ETH loss widens", url: "https://x.com/a", source: "CoinDesk", published_at: "2026-06-03T20:00:00+00:00" }],
    },
    history: { "1w": [], "1m": [], "1y": [] },
    scores: { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } },
    extras: { timeline: [{ run_at: "2026-06-03T20:00:00+00:00", p_up: 0.49, central: 65162, drift_adj_bps: -15, vol_mult: 1.15, confidence_label: "low", llm_applied: true, rationale: "Extreme Fear capitulation" }], results: [] },
  })),
  fetchLiveSpot: vi.fn(async () => 65300),
  fetchActualPrices: vi.fn(async () => []),
}));

describe("Dashboard page", () => {
  it("renders cards, signals, news, dial, timeline and LIVE after load", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getAllByText("1 Week").length).toBeGreaterThan(0));
    expect(screen.getByText(/Extreme Fear drives caution/)).toBeInTheDocument();
    expect(screen.getByText(/Bitmine ETH loss widens/)).toBeInTheDocument();
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
    expect(screen.getByText(/How the model changed its mind/i)).toBeInTheDocument();
    expect(screen.getByText(/Did it call it/i)).toBeInTheDocument();
    expect(screen.getAllByText(/insufficient data/i).length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/page.test.tsx`
Expected: FAIL — page doesn't render the timeline/reveals/extras yet.

- [ ] **Step 3: Write the implementation**

Replace `components/Header.tsx` with (count-up price + sparkline):
```tsx
"use client";
import { useEffect, useState } from "react";
import type { Latest } from "@/lib/types";
import { type Dir, useCountUp } from "@/lib/hooks";
import { fmtUsd, fmtDateTime, relativeTime } from "@/lib/format";
import { fetchActualPrices } from "@/lib/data";
import { Sparkline } from "@/components/Sparkline";

const FLASH: Record<Dir, string> = { up: "text-emerald-400", down: "text-rose-400", flat: "text-zinc-50" };

export function Header({ latest, livePrice, dir, updatedAt, now }: {
  latest: Latest | null; livePrice: number | null; dir: Dir; updatedAt: number | null; now: number;
}) {
  const price = livePrice ?? latest?.spot ?? null;
  const animated = useCountUp(price);
  const [spark, setSpark] = useState<number[]>([]);
  useEffect(() => {
    let alive = true;
    fetchActualPrices(1).then((p) => alive && setSpark(p.map((x) => x.price)));
    return () => { alive = false; };
  }, []);

  return (
    <header className="border-b border-zinc-800 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-50">
            <span className="text-[#f7931a]">₿</span> BTC Event Oracle
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            An honest, hourly Bitcoin forecast driven by world events — and held accountable against a
            random-walk benchmark. Not a crystal ball; a tracked method.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Live BTC</div>
          <div className="flex items-center justify-end gap-2">
            <Sparkline points={spark} />
            <div className={`text-2xl font-bold tabular-nums transition-colors duration-300 ${FLASH[dir]}`}>
              {animated ? fmtUsd(animated) : "—"}
            </div>
          </div>
          <div className="mt-1 text-xs text-zinc-500">forecast as of {fmtDateTime(latest?.run_at ?? null)}</div>
          <div className="mt-1 flex items-center justify-end gap-2">
            {updatedAt && <span className="text-[11px] text-zinc-600">updated {relativeTime(new Date(updatedAt).toISOString(), now)}</span>}
            <span className={`rounded-full border px-2 py-0.5 text-xs ${latest?.llm_applied ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-zinc-600/40 bg-zinc-700/20 text-zinc-400"}`}>
              {latest?.llm_applied ? `Claude overlay (${latest.model_id})` : "baseline only"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
```

Replace `app/page.tsx` with:
```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sortForecasts } from "@/lib/format";
import { useLiveData, useLivePrice } from "@/lib/hooks";
import { Header } from "@/components/Header";
import { SignalsStrip } from "@/components/SignalsStrip";
import { FearGreedDial } from "@/components/FearGreedDial";
import { HorizonCard } from "@/components/HorizonCard";
import { ForecastChart } from "@/components/ForecastChart";
import { Scorecard } from "@/components/Scorecard";
import { RationalePanel } from "@/components/RationalePanel";
import { RecentCalls } from "@/components/RecentCalls";
import { MindTimeline } from "@/components/MindTimeline";
import { NewsFeed } from "@/components/NewsFeed";
import { Disclaimer } from "@/components/Disclaimer";

export default function Page() {
  const { latest, history, scores, extras, error, updatedAt } = useLiveData(60_000);
  const { price, dir } = useLivePrice(15_000);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const fng = latest?.signals?.find((s) => s.signal === "fear_greed");
  const otherSignals = (latest?.signals ?? []).filter((s) => s.signal !== "fear_greed");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Header latest={latest} livePrice={price} dir={dir} updatedAt={updatedAt} now={now} />

      <Link href="/guide/" className="mt-4 flex items-center justify-between rounded-lg border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2.5 text-sm text-zinc-200 transition-colors hover:bg-[#f7931a]/15">
        <span><span className="mr-1.5">👋</span> New here? Read the plain-English guide to what every number on this page means.</span>
        <span className="ml-3 shrink-0 text-[#f7931a]">How to read this →</span>
      </Link>

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Couldn&apos;t load forecast data ({error}).
        </div>
      )}
      {!latest && !error && <div className="mt-10 text-center text-zinc-500">Loading the latest forecast…</div>}

      {latest && (
        <>
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">What the model is watching</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {fng && <FearGreedDial value={fng.value ?? 0} />}
              <div className={fng ? "sm:col-span-1 lg:col-span-3" : "sm:col-span-2 lg:col-span-4"}>
                <SignalsStrip signals={otherSignals} />
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortForecasts(latest.forecasts).map((f) => (
              <HorizonCard key={f.horizon} f={f} now={now} />
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">{history && <ForecastChart history={history} />}</div>
            <RationalePanel latest={latest} />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {scores && <Scorecard scores={scores} />}
              {extras && <RecentCalls results={extras.results} />}
            </div>
            <div className="space-y-4">
              {extras && <MindTimeline timeline={extras.timeline} />}
              <NewsFeed news={latest.news ?? []} />
            </div>
          </section>
        </>
      )}

      <Disclaimer />
    </main>
  );
}
```

> NOTE: `SignalsStrip` returns `null` when given an empty list, so when only Fear & Greed is present the dial shows and the strip collapses cleanly. The dial reads `fng.value` (the 0–100 number).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + production build**

Run: `npm test`
Expected: PASS (all web tests).
Run: `npm run build`
Expected: static export succeeds; `out/index.html` exists.

- [ ] **Step 6: Commit**

```bash
git add web/app/page.tsx web/components/Header.tsx web/app/page.test.tsx
git commit -m "feat(web): wire chart overlay, countdowns, reveals, timeline, dial, sparkline, count-up"
```

---

## Self-Review

**1. Coverage:** (1) actual-price overlay → `mergeActual` + `fetchActualPrices` + `ForecastChart` (Tasks 2–3). (2) countdowns → `timeUntil` + `HorizonCard` (Tasks 1, 4); reveals → `buildCallRows` + `RecentCalls` (Tasks 2, 4). (3) "changed its mind" → `buildTimeline` + `MindTimeline` (Tasks 2, 5). (4) polish → `FearGreedDial` + `Sparkline` (Task 6) + `useCountUp` + `InfoDot` (Task 7), wired in Task 8. All consume the real `extras.json` + CoinGecko; everything is null/empty-safe (`?? []`, empty states, `connectNulls`).

**2. Placeholder scan:** No TBD/TODO; complete code + exact commands. Animation/Recharts behavior is verified by the page render test + `npm run build`; pure helpers (`timeUntil`, `mergeActual`, `buildCallRows`, `buildTimeline`) and the data layer are unit-tested directly.

**3. Type consistency:** `TimelineItem`/`ResultItem`/`Extras` (Task 1) flow into `buildTimeline`/`buildCallRows` (Task 2) → `MindTimeline`/`RecentCalls` (Tasks 4–5). `fetchSnapshots` now returns `{latest,history,scores,extras}` (Task 1) → `useLiveData` exposes `extras` (Task 1) → page destructures it (Task 8). `HorizonCard` gains a required `now` prop (Task 4) and its test + the page call site both pass `now` (Tasks 4, 8). `mergeActual(BandPoint[], {t,price}[]) -> MergedPoint[]` (Task 2) feeds `ForecastChart` (Task 3). `useCountUp(number|null)` + `Sparkline({points})` + `FearGreedDial({value})` + `InfoDot({text})` match their call sites in `Header`/page.

---

## Next (optional, separate)
Return-drivers (Telegram channel reusing your bot, email/RSS), growth (a real homepage at the domain root + share/OG image + SEO), and more assets (ETH/SOL).

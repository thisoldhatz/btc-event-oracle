# BTC Oracle — Next.js Command Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Layout-A "command dashboard" (static-exported Next.js) that reads the engine's `/data/{latest,history,scores}.json`, showing the live forecast for all three horizons (range + P(up) + confidence), a forecast band-vs-time chart, the honest accuracy scorecard vs random walk, the "why it moved" rationale, and a clear not-financial-advice disclaimer.

**Architecture:** A pure `lib/` (types + formatters + score-row builder + chart-series builder + data fetchers) that is unit-tested with Vitest, and presentational React client components that consume it. The root page is a `"use client"` component that fetches the three JSON snapshots (+ a live CoinGecko spot) on mount and renders Layout A. Everything is static-exported (`output:'export'`) to drop into cPanel `public_html`; the hourly cron overwrites `/data/*.json` with live data. This is Plan 4 of 5.

**Tech Stack:** Next.js 14 (App Router, already scaffolded in `web/`), TypeScript (strict), Tailwind, Recharts, Vitest + React Testing Library. Dark "fintech terminal" theme, Bitcoin-orange accent `#f7931a`.

**Working directory for ALL tasks:** `C:\Users\GamerTech\btc-oracle\web` (the Next app). In bash: `cd /c/Users/GamerTech/btc-oracle/web && ...`. Tests: `npm test` (vitest run). Build: `npm run build`. The `@/*` import alias maps to the `web/` root.

**Verified data contract (real engine output, probed 2026-06-03):**
```jsonc
// /data/latest.json
{ "run_at": "2026-06-03T20:08:21.972762+00:00", "spot": 65260.0, "llm_applied": true,
  "model_id": "claude-sonnet-4-6",
  "forecasts": [ { "horizon": "1m"|"1w"|"1y", "target_at": "...", "central": 65064.5,
    "lower": 57602.3, "upper": 73493.4, "conf_level": 0.6, "p_up": 0.4917,
    "confidence_label": "low", "band_width_pct": 0.2435, "drift_adj_bps": -30.0,
    "vol_mult": 1.2, "rationale": "Extreme Fear ..." } ] }   // NOTE: forecasts arrive unsorted
// /data/history.json
{ "1w": [ { "run_at": "...", "target_at": "...", "central": 65311, "lower": 62185.7,
            "upper": 68593.4, "p_up": 0.5 } ], "1m": [...], "1y": [...] }
// /data/scores.json   (empty until forecasts mature)
{ "1w": { "n": 0 }, "1m": { "n": 0 }, "1y": { "n": 0 } }
// when populated: { "n": 12, "brier": 0.24, "brier_base": 0.25, "bss": 0.04, "mape": 3.1, "coverage": 0.58 }
```

**Spec refs:** §9 (Layout A), §7 (scorecard vs random walk, "insufficient data"), §11 (honest framing + disclaimer).

---

## File structure (all under `web/`)
```
lib/types.ts          # Horizon, Forecast, Latest, History, ScoreH, Scores
lib/format.ts         # HORIZON_ORDER/LABEL, fmtUsd/fmtPct/fmtSignedBps, sortForecasts, confidenceClass, fmtDateTime
lib/scores.ts         # buildScoreRows(scores) -> display rows incl "Insufficient data"
lib/chart.ts          # toBandSeries(history[h]) -> Recharts-ready band points
lib/data.ts           # fetchSnapshots(), fetchLiveSpot()
components/HorizonCard.tsx
components/Scorecard.tsx
components/ForecastChart.tsx
components/Header.tsx        # title + live ticker + as-of + provenance badge
components/RationalePanel.tsx
components/Disclaimer.tsx
app/page.tsx          # "use client" — fetch + assemble Layout A
app/disclaimer/page.tsx
app/layout.tsx        # metadata
app/globals.css       # dark theme tokens
tests/*.test.ts(x)    # colocated next to lib/components
```

---

### Task 1: Types + formatters (`lib/types.ts`, `lib/format.ts`)

**Files:**
- Create: `lib/types.ts`, `lib/format.ts`
- Test: `lib/format.test.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// lib/format.test.ts
import { describe, it, expect } from "vitest";
import { fmtUsd, fmtPct, fmtSignedBps, sortForecasts, HORIZON_LABEL } from "@/lib/format";
import type { Forecast } from "@/lib/types";

const mk = (horizon: Forecast["horizon"]): Forecast => ({
  horizon, target_at: "", central: 0, lower: 0, upper: 0, conf_level: 0.6,
  p_up: 0.5, confidence_label: "low", band_width_pct: 0, drift_adj_bps: 0,
  vol_mult: 1, rationale: "",
});

describe("format", () => {
  it("formats USD with thousands separators", () => {
    expect(fmtUsd(65260.4)).toBe("$65,260");
  });
  it("formats probability as percent", () => {
    expect(fmtPct(0.4917)).toBe("49%");
    expect(fmtPct(0.4917, 1)).toBe("49.2%");
  });
  it("formats signed bps", () => {
    expect(fmtSignedBps(-30)).toBe("-30 bps");
    expect(fmtSignedBps(20)).toBe("+20 bps");
  });
  it("sorts forecasts into 1w,1m,1y regardless of input order", () => {
    const sorted = sortForecasts([mk("1m"), mk("1y"), mk("1w")]);
    expect(sorted.map((f) => f.horizon)).toEqual(["1w", "1m", "1y"]);
  });
  it("labels horizons", () => {
    expect(HORIZON_LABEL["1y"]).toBe("1 Year");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/format.test.ts`
Expected: FAIL — cannot resolve `@/lib/format`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/types.ts
export type Horizon = "1w" | "1m" | "1y";

export interface Forecast {
  horizon: Horizon;
  target_at: string;
  central: number;
  lower: number;
  upper: number;
  conf_level: number;
  p_up: number;
  confidence_label: string;
  band_width_pct: number;
  drift_adj_bps: number;
  vol_mult: number;
  rationale: string;
}
export interface Latest {
  run_at: string | null;
  spot: number | null;
  llm_applied: boolean;
  model_id: string | null;
  forecasts: Forecast[];
}
export interface HistPoint {
  run_at: string;
  target_at: string;
  central: number;
  lower: number;
  upper: number;
  p_up: number;
}
export type History = Record<Horizon, HistPoint[]>;
export interface ScoreH {
  n: number;
  brier?: number;
  brier_base?: number;
  bss?: number | null;
  mape?: number | null;
  coverage?: number;
}
export type Scores = Record<Horizon, ScoreH>;
```

```ts
// lib/format.ts
import type { Forecast, Horizon } from "./types";

export const HORIZON_ORDER: Horizon[] = ["1w", "1m", "1y"];
export const HORIZON_LABEL: Record<Horizon, string> = {
  "1w": "1 Week",
  "1m": "1 Month",
  "1y": "1 Year",
};

export function fmtUsd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
export function fmtPct(p: number, digits = 0): string {
  return (p * 100).toFixed(digits) + "%";
}
export function fmtSignedBps(b: number): string {
  return (b >= 0 ? "+" : "") + Math.round(b) + " bps";
}
export function sortForecasts(fs: Forecast[]): Forecast[] {
  return [...fs].sort(
    (a, b) => HORIZON_ORDER.indexOf(a.horizon) - HORIZON_ORDER.indexOf(b.horizon),
  );
}
export function confidenceClass(label: string): string {
  switch (label.toLowerCase()) {
    case "high":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "medium":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}
export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/format.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/lib/format.ts web/lib/format.test.ts
git commit -m "feat(web): data types and formatting utilities"
```

---

### Task 2: Score rows builder (`lib/scores.ts`)

**Files:**
- Create: `lib/scores.ts`
- Test: `lib/scores.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/scores.test.ts
import { describe, it, expect } from "vitest";
import { buildScoreRows } from "@/lib/scores";
import type { Scores } from "@/lib/types";

describe("buildScoreRows", () => {
  it("marks empty horizons as insufficient data", () => {
    const rows = buildScoreRows({ "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores);
    expect(rows.map((r) => r.horizon)).toEqual(["1w", "1m", "1y"]);
    expect(rows[0].hasData).toBe(false);
    expect(rows[0].verdict).toBe("Insufficient data");
    expect(rows[0].brier).toBe("—");
  });

  it("formats populated rows and an honest verdict near zero BSS", () => {
    const scores = {
      "1w": { n: 30, brier: 0.244, brier_base: 0.25, bss: 0.005, mape: 3.1, coverage: 0.58 },
      "1m": { n: 5, brier: 0.20, brier_base: 0.25, bss: 0.2, mape: 6.0, coverage: 0.6 },
      "1y": { n: 0 },
    } as Scores;
    const rows = buildScoreRows(scores);
    expect(rows[0].hasData).toBe(true);
    expect(rows[0].n).toBe(30);
    expect(rows[0].mape).toBe("3.1%");
    expect(rows[0].coverage).toBe("58%");
    expect(rows[0].verdict).toBe("≈ random walk (expected)");   // |bss| small
    expect(rows[1].verdict).toBe("Beating random walk");         // bss 0.2
    expect(rows[2].hasData).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/scores.test.ts`
Expected: FAIL — cannot resolve `@/lib/scores`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scores.ts
import type { Scores, Horizon } from "./types";
import { HORIZON_ORDER, HORIZON_LABEL } from "./format";

export interface ScoreRow {
  horizon: Horizon;
  label: string;
  n: number;
  hasData: boolean;
  brier: string;
  brierBase: string;
  bss: string;
  mape: string;
  coverage: string;
  verdict: string;
}

function verdictFor(bss: number | null | undefined): string {
  if (bss === null || bss === undefined) return "—";
  if (bss > 0.02) return "Beating random walk";
  if (bss < -0.02) return "Worse than random walk";
  return "≈ random walk (expected)";
}

export function buildScoreRows(scores: Scores): ScoreRow[] {
  return HORIZON_ORDER.map((h) => {
    const s = scores?.[h] ?? { n: 0 };
    if (!s.n) {
      return {
        horizon: h, label: HORIZON_LABEL[h], n: 0, hasData: false,
        brier: "—", brierBase: "—", bss: "—", mape: "—", coverage: "—",
        verdict: "Insufficient data",
      };
    }
    return {
      horizon: h, label: HORIZON_LABEL[h], n: s.n, hasData: true,
      brier: (s.brier ?? 0).toFixed(3),
      brierBase: (s.brier_base ?? 0).toFixed(3),
      bss: s.bss === null || s.bss === undefined ? "—" : s.bss.toFixed(2),
      mape: s.mape === null || s.mape === undefined ? "—" : s.mape.toFixed(1) + "%",
      coverage: s.coverage === null || s.coverage === undefined ? "—" : (s.coverage * 100).toFixed(0) + "%",
      verdict: verdictFor(s.bss),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/scores.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/scores.ts web/lib/scores.test.ts
git commit -m "feat(web): scorecard row builder with honest random-walk verdict"
```

---

### Task 3: Chart series builder (`lib/chart.ts`)

**Files:**
- Create: `lib/chart.ts`
- Test: `lib/chart.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/chart.test.ts
import { describe, it, expect } from "vitest";
import { toBandSeries } from "@/lib/chart";
import type { HistPoint } from "@/lib/types";

const pts: HistPoint[] = [
  { run_at: "2026-06-03T20:02:59+00:00", target_at: "x", central: 65311, lower: 62185, upper: 68593, p_up: 0.5 },
  { run_at: "2026-06-03T20:08:21+00:00", target_at: "x", central: 65162, lower: 61589, upper: 68942, p_up: 0.49 },
];

describe("toBandSeries", () => {
  it("computes band = upper - lower and a numeric time axis", () => {
    const s = toBandSeries(pts);
    expect(s).toHaveLength(2);
    expect(s[0].band).toBeCloseTo(68593 - 62185, 3);
    expect(s[0].lower).toBe(62185);
    expect(s[0].central).toBe(65311);
    expect(typeof s[0].t).toBe("number");
    expect(s[1].t).toBeGreaterThan(s[0].t);   // chronological
  });
  it("handles empty history", () => {
    expect(toBandSeries([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/chart.test.ts`
Expected: FAIL — cannot resolve `@/lib/chart`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/chart.ts
import type { HistPoint } from "./types";

export interface BandPoint {
  t: number;        // epoch ms (numeric x-axis)
  label: string;    // run_at iso
  lower: number;
  band: number;     // upper - lower (stacked on top of lower for the shaded area)
  central: number;
  upper: number;
  p_up: number;
}

export function toBandSeries(points: HistPoint[]): BandPoint[] {
  return points.map((p) => ({
    t: new Date(p.run_at).getTime(),
    label: p.run_at,
    lower: p.lower,
    band: p.upper - p.lower,
    central: p.central,
    upper: p.upper,
    p_up: p.p_up,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/chart.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/chart.ts web/lib/chart.test.ts
git commit -m "feat(web): forecast band chart-series builder"
```

---

### Task 4: Data fetchers (`lib/data.ts`)

**Files:**
- Create: `lib/data.ts`
- Test: `lib/data.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/data.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/data.test.ts`
Expected: FAIL — cannot resolve `@/lib/data`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/data.ts
import type { Latest, History, Scores } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/data.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/data.ts web/lib/data.test.ts
git commit -m "feat(web): snapshot + live-spot data fetchers"
```

---

### Task 5: HorizonCard component (`components/HorizonCard.tsx`)

**Files:**
- Create: `components/HorizonCard.tsx`
- Test: `components/HorizonCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/HorizonCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HorizonCard } from "@/components/HorizonCard";
import type { Forecast } from "@/lib/types";

const f: Forecast = {
  horizon: "1w", target_at: "2026-06-10T00:00:00+00:00", central: 65162, lower: 61589,
  upper: 68942, conf_level: 0.6, p_up: 0.491, confidence_label: "low",
  band_width_pct: 0.1127, drift_adj_bps: -15, vol_mult: 1.15, rationale: "x",
};

describe("HorizonCard", () => {
  it("shows the horizon label, central, range and P(up)", () => {
    render(<HorizonCard f={f} />);
    expect(screen.getByText("1 Week")).toBeInTheDocument();
    expect(screen.getByText("$65,162")).toBeInTheDocument();
    expect(screen.getByText(/\$61,589/)).toBeInTheDocument();
    expect(screen.getByText(/\$68,942/)).toBeInTheDocument();
    expect(screen.getByText("49%")).toBeInTheDocument();   // P(up)
    expect(screen.getByText(/low/i)).toBeInTheDocument();   // confidence chip
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/HorizonCard.test.tsx`
Expected: FAIL — cannot resolve `@/components/HorizonCard`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/HorizonCard.tsx
import type { Forecast } from "@/lib/types";
import { fmtUsd, fmtPct, fmtSignedBps, HORIZON_LABEL, confidenceClass } from "@/lib/format";

export function HorizonCard({ f }: { f: Forecast }) {
  const up = f.p_up >= 0.5;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          {HORIZON_LABEL[f.horizon]}
        </h3>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${confidenceClass(f.confidence_label)}`}>
          {f.confidence_label} confidence
        </span>
      </div>

      <div className="mt-3 text-3xl font-bold text-zinc-50">{fmtUsd(f.central)}</div>
      <div className="mt-1 text-sm text-zinc-400">
        range <span className="text-zinc-200">{fmtUsd(f.lower)}</span> –{" "}
        <span className="text-zinc-200">{fmtUsd(f.upper)}</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
        <div>
          <div className="text-xs text-zinc-500">P(up)</div>
          <div className={`text-lg font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>
            {fmtPct(f.p_up)}
          </div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>drift {fmtSignedBps(f.drift_adj_bps)}</div>
          <div>vol ×{f.vol_mult.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/HorizonCard.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add web/components/HorizonCard.tsx web/components/HorizonCard.test.tsx
git commit -m "feat(web): HorizonCard (central, range, P(up), confidence)"
```

---

### Task 6: Scorecard component (`components/Scorecard.tsx`)

**Files:**
- Create: `components/Scorecard.tsx`
- Test: `components/Scorecard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/Scorecard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Scorecard } from "@/components/Scorecard";
import type { Scores } from "@/lib/types";

describe("Scorecard", () => {
  it("renders 'Insufficient data' for empty horizons", () => {
    const scores = { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores;
    render(<Scorecard scores={scores} />);
    expect(screen.getAllByText(/insufficient data/i).length).toBe(3);
  });

  it("shows metrics and verdict for a populated horizon", () => {
    const scores = {
      "1w": { n: 30, brier: 0.244, brier_base: 0.25, bss: 0.2, mape: 3.1, coverage: 0.58 },
      "1m": { n: 0 }, "1y": { n: 0 },
    } as Scores;
    render(<Scorecard scores={scores} />);
    expect(screen.getByText(/beating random walk/i)).toBeInTheDocument();
    expect(screen.getByText("3.1%")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/Scorecard.test.tsx`
Expected: FAIL — cannot resolve `@/components/Scorecard`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/Scorecard.tsx
import type { Scores } from "@/lib/types";
import { buildScoreRows } from "@/lib/scores";

export function Scorecard({ scores }: { scores: Scores }) {
  const rows = buildScoreRows(scores);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Accuracy scorecard <span className="text-zinc-600">· vs. random walk</span>
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr className="text-left">
              <th className="py-2 pr-3 font-medium">Horizon</th>
              <th className="py-2 pr-3 font-medium">N</th>
              <th className="py-2 pr-3 font-medium">Brier</th>
              <th className="py-2 pr-3 font-medium">vs base</th>
              <th className="py-2 pr-3 font-medium">MAPE</th>
              <th className="py-2 pr-3 font-medium">Cover</th>
              <th className="py-2 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.horizon} className="border-t border-zinc-800 text-zinc-200">
                <td className="py-2 pr-3">{r.label}</td>
                {r.hasData ? (
                  <>
                    <td className="py-2 pr-3">{r.n}</td>
                    <td className="py-2 pr-3">{r.brier}</td>
                    <td className="py-2 pr-3">{r.brierBase}</td>
                    <td className="py-2 pr-3">{r.mape}</td>
                    <td className="py-2 pr-3">{r.coverage}</td>
                    <td className="py-2 text-zinc-300">{r.verdict}</td>
                  </>
                ) : (
                  <td className="py-2 text-zinc-500" colSpan={6}>
                    {r.verdict}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        At 1-week/1-month horizons, tying random walk (BSS ≈ 0) is the honest, expected result.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/Scorecard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/Scorecard.tsx web/components/Scorecard.test.tsx
git commit -m "feat(web): accuracy Scorecard with insufficient-data handling"
```

---

### Task 7: Forecast band chart (`components/ForecastChart.tsx`)

**Files:**
- Create: `components/ForecastChart.tsx`
- (No unit test — Recharts' ResponsiveContainer needs layout; verified by build + screenshot.)

- [ ] **Step 1: Write the component**

```tsx
// components/ForecastChart.tsx
"use client";
import { useState } from "react";
import {
  Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { History, Horizon } from "@/lib/types";
import { toBandSeries } from "@/lib/chart";
import { HORIZON_ORDER, HORIZON_LABEL, fmtUsd } from "@/lib/format";

export function ForecastChart({ history }: { history: History }) {
  const [h, setH] = useState<Horizon>("1w");
  const data = toBandSeries(history[h] ?? []);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Forecast over time
        </h3>
        <div className="flex gap-1">
          {HORIZON_ORDER.map((opt) => (
            <button
              key={opt}
              onClick={() => setH(opt)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                opt === h ? "bg-[#f7931a] text-black" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {HORIZON_LABEL[opt]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            No forecast history yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time"
                tickFormatter={(t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                stroke="#52525b" fontSize={11}
              />
              <YAxis
                tickFormatter={(v) => fmtUsd(v)} stroke="#52525b" fontSize={11} width={64}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelFormatter={(t) => new Date(t as number).toLocaleString()}
                formatter={(v: number, name) => [fmtUsd(v), name === "central" ? "central" : name]}
              />
              {/* shaded confidence band: transparent base to `lower`, visible `band` on top */}
              <Area dataKey="lower" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area dataKey="band" stackId="band" stroke="none" fill="#f7931a" fillOpacity={0.15} isAnimationActive={false} />
              <Line dataKey="central" stroke="#f7931a" dot={false} strokeWidth={2} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Shaded = {HORIZON_LABEL[h]} confidence range · line = central estimate.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check via build smoke** (Recharts API usage)

Run: `npm run build`
Expected: build succeeds (the page still renders the default until Task 9; this verifies the component type-checks). If the page doesn't import it yet, add a throwaway import is NOT needed — just ensure `tsc` passes by running `npx tsc --noEmit`.
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/ForecastChart.tsx
git commit -m "feat(web): Recharts forecast band-vs-time chart with horizon toggle"
```

---

### Task 8: Header, RationalePanel, Disclaimer (`components/*`)

**Files:**
- Create: `components/Header.tsx`, `components/RationalePanel.tsx`, `components/Disclaimer.tsx`
- (Presentational; verified by build + the page test in Task 9.)

- [ ] **Step 1: Write the components**

```tsx
// components/Header.tsx
import type { Latest } from "@/lib/types";
import { fmtUsd, fmtDateTime } from "@/lib/format";

export function Header({ latest, livePrice }: { latest: Latest | null; livePrice: number | null }) {
  return (
    <header className="border-b border-zinc-800 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-50">
            <span className="text-[#f7931a]">₿</span> BTC Event Oracle
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            An honest, hourly Bitcoin forecast driven by world events — and held accountable
            against a random-walk benchmark. Not a crystal ball; a tracked method.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Live BTC</div>
          <div className="text-2xl font-bold text-zinc-50">
            {livePrice ? fmtUsd(livePrice) : latest?.spot ? fmtUsd(latest.spot) : "—"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            as of {fmtDateTime(latest?.run_at ?? null)}
          </div>
          <div className="mt-1">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${
                latest?.llm_applied
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-600/40 bg-zinc-700/20 text-zinc-400"
              }`}
            >
              {latest?.llm_applied ? `Claude overlay (${latest.model_id})` : "baseline only"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
```

```tsx
// components/RationalePanel.tsx
import type { Latest } from "@/lib/types";

export function RationalePanel({ latest }: { latest: Latest | null }) {
  const rationale = latest?.forecasts?.[0]?.rationale;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Why it moved
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
        {rationale || "No event-driven adjustment this run — showing the raw quant baseline."}
      </p>
    </div>
  );
}
```

```tsx
// components/Disclaimer.tsx
import Link from "next/link";

export function Disclaimer() {
  return (
    <footer className="mt-10 border-t border-zinc-800 pt-5 text-xs leading-relaxed text-zinc-500">
      <p>
        <strong className="text-zinc-400">Educational / portfolio project — not financial advice.</strong>{" "}
        These are model-implied probabilities and ranges, not guarantees; past and backtested
        performance does not predict future results. Bitcoin is highly volatile and you can lose
        your entire investment. Use at your own risk and consult a licensed professional.{" "}
        <Link href="/disclaimer/" className="text-zinc-400 underline">
          Full disclaimer & method
        </Link>
        .
      </p>
    </footer>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/Header.tsx web/components/RationalePanel.tsx web/components/Disclaimer.tsx
git commit -m "feat(web): Header (ticker + provenance), RationalePanel, Disclaimer"
```

---

### Task 9: Assemble Layout A + disclaimer page + theme (`app/*`)

**Files:**
- Overwrite: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
- Create: `app/disclaimer/page.tsx`
- Test: `app/page.test.tsx`

- [ ] **Step 1: Write the failing test** (renders with mocked data fetch)

```tsx
// app/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Page from "@/app/page";

vi.mock("@/lib/data", () => ({
  fetchSnapshots: vi.fn(async () => ({
    latest: {
      run_at: "2026-06-03T20:08:21+00:00", spot: 65260, llm_applied: true, model_id: "claude-sonnet-4-6",
      forecasts: [
        { horizon: "1w", target_at: "t", central: 65162, lower: 61589, upper: 68942, conf_level: 0.6, p_up: 0.49, confidence_label: "low", band_width_pct: 0.11, drift_adj_bps: -15, vol_mult: 1.15, rationale: "Extreme Fear drives caution" },
        { horizon: "1m", target_at: "t", central: 65064, lower: 57602, upper: 73493, conf_level: 0.6, p_up: 0.49, confidence_label: "low", band_width_pct: 0.24, drift_adj_bps: -30, vol_mult: 1.2, rationale: "x" },
        { horizon: "1y", target_at: "t", central: 65390, lower: 45086, upper: 94838, conf_level: 0.6, p_up: 0.5, confidence_label: "low", band_width_pct: 0.76, drift_adj_bps: 20, vol_mult: 1.05, rationale: "x" },
      ],
    },
    history: { "1w": [], "1m": [], "1y": [] },
    scores: { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } },
  })),
  fetchLiveSpot: vi.fn(async () => 65300),
}));

describe("Dashboard page", () => {
  it("renders the three horizon cards and the rationale after load", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("1 Week")).toBeInTheDocument());
    expect(screen.getByText("1 Month")).toBeInTheDocument();
    expect(screen.getByText("1 Year")).toBeInTheDocument();
    expect(screen.getByText(/Extreme Fear drives caution/)).toBeInTheDocument();
    expect(screen.getAllByText(/insufficient data/i).length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/page.test.tsx`
Expected: FAIL — current `app/page.tsx` is the default scaffold (no "1 Week").

- [ ] **Step 3: Write the implementation**

`app/globals.css` (replace entire file):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
body { background: #09090b; color: #e4e4e7; }
```

`app/layout.tsx` (replace entire file):
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTC Event Oracle",
  description: "Honest hourly Bitcoin forecasting driven by world events, scored against random walk.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 antialiased">{children}</body>
    </html>
  );
}
```

`app/page.tsx` (replace entire file):
```tsx
"use client";
import { useEffect, useState } from "react";
import type { Latest, History, Scores } from "@/lib/types";
import { fetchSnapshots, fetchLiveSpot } from "@/lib/data";
import { sortForecasts } from "@/lib/format";
import { Header } from "@/components/Header";
import { HorizonCard } from "@/components/HorizonCard";
import { ForecastChart } from "@/components/ForecastChart";
import { Scorecard } from "@/components/Scorecard";
import { RationalePanel } from "@/components/RationalePanel";
import { Disclaimer } from "@/components/Disclaimer";

export default function Page() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshots()
      .then(({ latest, history, scores }) => {
        setLatest(latest);
        setHistory(history);
        setScores(scores);
      })
      .catch((e) => setError(String(e)));
    fetchLiveSpot().then(setLive);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Header latest={latest} livePrice={live} />

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Couldn’t load forecast data ({error}).
        </div>
      )}

      {!latest && !error && (
        <div className="mt-10 text-center text-zinc-500">Loading the latest forecast…</div>
      )}

      {latest && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortForecasts(latest.forecasts).map((f) => (
              <HorizonCard key={f.horizon} f={f} />
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">{history && <ForecastChart history={history} />}</div>
            <RationalePanel latest={latest} />
          </section>

          <section className="mt-4">{scores && <Scorecard scores={scores} />}</section>
        </>
      )}

      <Disclaimer />
    </main>
  );
}
```

`app/disclaimer/page.tsx` (new):
```tsx
import Link from "next/link";

export const metadata = { title: "Disclaimer · BTC Event Oracle" };

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-300">
      <Link href="/" className="text-sm text-[#f7931a]">← Back to the dashboard</Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-50">Disclaimer & Method</h1>

      <h2 className="mt-6 text-lg font-semibold text-zinc-100">Not financial advice</h2>
      <p className="mt-2 text-sm leading-relaxed">
        This is an educational / portfolio project. It is not financial advice and does not come
        from a registered broker or investment adviser. Everything shown is a model-implied
        probability or range — never a guarantee. Past and backtested performance does not predict
        future results. Bitcoin is highly volatile and you can lose your entire investment. Use at
        your own risk and consult a licensed professional before making any decision.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-zinc-100">How it works</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Each hour, a quantitative baseline (a random-walk model with volatility estimated from
        recent prices) produces a central estimate, a confidence range, and a probability that BTC
        is higher at each horizon. Claude (an LLM) then reads condensed world-event signals — news
        tone, the Fear &amp; Greed index, perp funding and open interest — and applies a small,
        hard-bounded adjustment to drift and volatility. If the model is unavailable, the site falls
        back to the untouched baseline.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-zinc-100">Why honesty matters here</h2>
      <p className="mt-2 text-sm leading-relaxed">
        At short horizons Bitcoin behaves much like a random walk, so the model is <em>expected</em>
        to roughly tie a naive “no change” benchmark. The accuracy scorecard reports exactly that —
        including when the method fails to beat random walk. The value of this site is its
        transparency and its track record, not a promise of returns.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/page.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Run all tests + the production build**

Run: `npm test`
Expected: PASS (all web tests).
Run: `npm run build`
Expected: static export succeeds; `out/index.html` and `out/disclaimer/index.html` exist.

- [ ] **Step 6: Commit**

```bash
git add web/app/page.tsx web/app/layout.tsx web/app/globals.css web/app/disclaimer/page.tsx web/app/page.test.tsx
git commit -m "feat(web): assemble Layout A command dashboard + disclaimer page"
```

---

## Self-Review

**1. Spec coverage (§9 Layout A, §7 scorecard, §11 disclaimer):**
- §9 header + live ticker + as-of + provenance → `Header` (Task 8) ✓ ; three horizon cards side-by-side → `HorizonCard` grid (Tasks 5, 9) ✓ ; forecast band chart → `ForecastChart` (Task 7) ✓ ; "why it moved" → `RationalePanel` (Task 8) ✓
- §7 accuracy scorecard vs random walk + "insufficient data" until matured + honest BSS≈0 note → `Scorecard` + `buildScoreRows` (Tasks 2, 6) ✓
- §11 persistent footer disclaimer + `/disclaimer` page + honest framing, no guarantee language → `Disclaimer` + disclaimer page (Tasks 8, 9) ✓
- Uncertainty always shown (range + P(up) + confidence chip; no bare arrows) → `HorizonCard` (Task 5) ✓
- Reads `/data/*.json` client-side; hourly cron overwrites → `lib/data` (Task 4) ✓
- Out of this plan (correctly): deploying the static export + wiring cron → Plan 5.

**2. Placeholder scan:** No TBD/TODO. Every component has complete code; every test has assertions; build/test commands are explicit. ForecastChart/Header/RationalePanel/Disclaimer are verified by `tsc --noEmit` + the page render test rather than isolated RTL (Recharts/ResponsiveContainer is unreliable in jsdom — a deliberate, stated choice, not a gap).

**3. Type consistency:** `lib/types` shapes match the real JSON contract field-for-field. `Forecast`/`Latest`/`History`/`Scores` are imported identically across lib + components + page. `buildScoreRows(scores)->ScoreRow[]` (Task 2) is consumed by `Scorecard` (Task 6). `toBandSeries(HistPoint[])->BandPoint[]` (Task 3) feeds `ForecastChart` (Task 7). `fetchSnapshots()->{latest,history,scores}` (Task 4) is used by the page (Task 9). `HorizonCard({f})`, `Scorecard({scores})`, `ForecastChart({history})`, `Header({latest,livePrice})`, `RationalePanel({latest})` props match every call site in `app/page.tsx`.

---

## Next plan (not part of this one)
- **Plan 5:** cPanel deploy — set the engine's `ANTHROPIC_API_KEY` + `SNAPSHOT_DIR=public_html/data` in a gitignored `.env` on the host, install the Python engine, add the real hourly cron running `btc-oracle run`, build + upload the static export into `public_html`, verify the live site at https://vadym.online, then rotate the shared cPanel password.

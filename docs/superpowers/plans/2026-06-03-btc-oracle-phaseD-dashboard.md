# BTC Oracle — Phase D (dashboard): Surface Methodology + Scoring + Markets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phases B+C visible: a **regime indicator** (widened-intervals note), a **"what real-money markets imply"** panel (Polymarket), a **calibration & skill panel** (CRPSS, BSS, coverage-vs-nominal, overlay-vs-baseline A/B, rolling windows — with an honest "insufficient data" state), a nicer **DVOL** signal label, and an interactive **"your call vs the model"** game (localStorage, self-resolving via CoinGecko).

**Architecture:** Extend the typed `lib/` (Market/Regime types, ScoreH new keys, `signalDisplay` DVOL case, a pure `yourcall` resolver), add presentational components, an `/about` methodology page, and wire into the page. Pure logic is Vitest-tested; visual is verified by the page render test + build. This is the dashboard half of Phase D (engine OG-cards/RSS + homepage are a separate small pass).

**Working dir:** `C:\Users\GamerTech\btc-oracle\web`. Bash: `cd /c/Users/GamerTech/btc-oracle/web && ...`. Tests `npm test -- <file>`; build `npm run build`; type-check `npx tsc --noEmit`. Git from repo root. Alias `@/*` → `web/`.

**Verified data (real, in `web/public/data/*.json` — refresh the fixtures from a local `cli run` first if stale):**
```jsonc
// latest.json adds:
"regime": { "label": "normal"|"elevated"|"high", "percentile": 0.50 },
"markets": [ { "question": "Will the price of Bitcoin be above $62,000 on June 4?", "yes_prob": 0.585, "end_date": "..." } ],
"signals": [ ..., { "source": "dvol", "signal": "implied_vol", "value": 48.0, "delta": -1.2, "interpretation": "Deribit implied vol ...", "observed_at": "..." } ]
// scores.json per horizon is EITHER {"n":0} OR:
{ "n": 12, "brier":.24, "brier_base":.25, "bss":.04, "mape":3.1, "coverage":.58, "crps":..., "crps_rw":...,
  "crpss":.05, "reliability":..., "resolution":..., "coverage_nominal":.60, "brier_ci":...,
  "windows": { "all":{...}, "last30":{...}, "last90":{...} },
  "ab": { "n":12, "model_brier":.24, "baseline_brier":.25, "model_crps":..., "baseline_crps":... } }
```
CoinGecko history (already used): `fetchActualPrices(days)` → `[{t, price}]`.

**Existing (don't break):** all of `lib/`, `components/`, `app/page.tsx`. `buildScoreRows` reads only the back-compat keys — keep using it for the basic scorecard; the new SkillPanel reads the rich keys.

---

### Task 1: Types + DVOL label + regime helper (`lib/types.ts`, `lib/format.ts`)

**Files:**
- Modify: `lib/types.ts`, `lib/format.ts`
- Test: `lib/format.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append)

```tsx
// lib/format.test.ts  (add)
import { signalDisplay, regimeNote } from "@/lib/format";
import type { Signal } from "@/lib/types";

describe("DVOL + regime", () => {
  it("labels the dvol implied-vol signal nicely", () => {
    const s: Signal = { source: "dvol", signal: "implied_vol", value: 48.2, delta: -1.5, interpretation: "x", observed_at: "" };
    const d = signalDisplay(s);
    expect(d.label).toBe("Implied vol");
    expect(d.value).toBe("48%");
  });
  it("regimeNote explains widening only when elevated/high", () => {
    expect(regimeNote("normal")).toBe("");
    expect(regimeNote("elevated").toLowerCase()).toContain("widened");
    expect(regimeNote("high").toLowerCase()).toContain("widened");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/format.test.ts`
Expected: FAIL — `regimeNote` missing / DVOL case missing.

- [ ] **Step 3: Write the implementation**

Append to `lib/types.ts`:
```ts
export interface Market {
  question: string;
  yes_prob: number;
  end_date: string | null;
}
export interface Regime {
  label: string;
  percentile: number;
}
```
Add to the existing `Latest` interface: `markets?: Market[];` and `regime?: Regime;`
Add the new optional keys to `ScoreH` (keep existing):
```ts
  crps?: number | null;
  crpss?: number | null;
  reliability?: number | null;
  resolution?: number | null;
  coverage_nominal?: number | null;
  brier_ci?: number | null;
  windows?: Record<"all" | "last30" | "last90", Partial<ScoreH>>;
  ab?: { n: number; model_brier?: number | null; baseline_brier?: number | null; model_crps?: number | null; baseline_crps?: number | null };
```

In `lib/format.ts`, add a `case "implied_vol"` to `signalDisplay` (before `default`):
```ts
    case "implied_vol":
      return { label: "Implied vol", value: `${Math.round(v)}%`, delta,
               hint: s.interpretation, tone: (s.delta ?? 0) > 0 ? "down" : "up" };
```
And append:
```ts
export function regimeNote(label: string): string {
  if (label === "high") return "High-volatility regime — intervals widened (the model is less reliable in turbulence).";
  if (label === "elevated") return "Elevated volatility — intervals modestly widened.";
  return "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/format.test.ts` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/lib/format.ts web/lib/format.test.ts
git commit -m "feat(web): Market/Regime types, DVOL label, regimeNote"
```

---

### Task 2: Markets panel (`components/MarketsPanel.tsx`)

**Files:**
- Create: `components/MarketsPanel.tsx`
- Test: `components/MarketsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/MarketsPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketsPanel } from "@/components/MarketsPanel";
import type { Market } from "@/lib/types";

describe("MarketsPanel", () => {
  it("renders markets with implied %", () => {
    const markets: Market[] = [{ question: "Will the price of Bitcoin be above $62,000 on June 4?", yes_prob: 0.585, end_date: "x" }];
    render(<MarketsPanel markets={markets} />);
    expect(screen.getByText(/above \$62,000/)).toBeInTheDocument();
    expect(screen.getByText("59%")).toBeInTheDocument();
  });
  it("shows empty state", () => {
    render(<MarketsPanel markets={[]} />);
    expect(screen.getByText(/no live markets/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/MarketsPanel.test.tsx`
Expected: FAIL — cannot resolve.

- [ ] **Step 3: Write the implementation**

```tsx
// components/MarketsPanel.tsx
import type { Market } from "@/lib/types";

export function MarketsPanel({ markets }: { markets: Market[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        What real-money markets imply <span className="text-zinc-600">· Polymarket</span>
      </h3>
      {(!markets || markets.length === 0) ? (
        <p className="mt-3 text-sm text-zinc-600">No live markets right now.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {markets.map((m, i) => {
            const pct = Math.round(m.yes_prob * 100);
            return (
              <li key={i}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{m.question}</span>
                  <span className="shrink-0 font-semibold text-zinc-100">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-[#60a5fa]" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-zinc-600">Live prices from a real-money prediction market — shown for context, not as our forecast.</p>
    </div>
  );
}
```

- [ ] **Step 4: Run test → PASS; `npx tsc --noEmit` → clean.**

- [ ] **Step 5: Commit**

```bash
git add web/components/MarketsPanel.tsx web/components/MarketsPanel.test.tsx
git commit -m "feat(web): 'what real-money markets imply' Polymarket panel"
```

---

### Task 3: Calibration & skill panel (`components/SkillPanel.tsx`)

**Files:**
- Create: `lib/skill.ts`, `components/SkillPanel.tsx`
- Test: `lib/skill.test.ts`, `components/SkillPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/skill.test.ts
import { describe, it, expect } from "vitest";
import { buildSkillRows } from "@/lib/skill";
import type { Scores } from "@/lib/types";

describe("buildSkillRows", () => {
  it("flags insufficient data when n=0", () => {
    const rows = buildSkillRows({ "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores);
    expect(rows[0].hasData).toBe(false);
  });
  it("formats CRPSS, coverage vs nominal, and the A/B verdict", () => {
    const scores = { "1w": { n: 20, crpss: 0.05, coverage: 0.55, coverage_nominal: 0.6,
        ab: { n: 20, model_brier: 0.22, baseline_brier: 0.25 } }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores;
    const r = buildSkillRows(scores)[0];
    expect(r.hasData).toBe(true);
    expect(r.crpss).toBe("+0.05");
    expect(r.coverage).toBe("55% (target 60%)");
    expect(r.abVerdict).toMatch(/overlay (beats|helps)/i);
  });
});
```

```tsx
// components/SkillPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillPanel } from "@/components/SkillPanel";
import type { Scores } from "@/lib/types";

describe("SkillPanel", () => {
  it("shows insufficient-data state", () => {
    render(<SkillPanel scores={{ "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } } as Scores} />);
    expect(screen.getAllByText(/not enough resolved forecasts/i).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests → FAIL** (`npm test -- lib/skill.test.ts components/SkillPanel.test.tsx`)

- [ ] **Step 3: Write the implementation**

```ts
// lib/skill.ts
import type { Scores, Horizon } from "./types";
import { HORIZON_ORDER, HORIZON_LABEL } from "./format";

export interface SkillRow {
  horizon: Horizon;
  label: string;
  n: number;
  hasData: boolean;
  crpss: string;
  bss: string;
  coverage: string;
  abVerdict: string;
}

function fmtSkill(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return `${x >= 0 ? "+" : ""}${x.toFixed(2)}`;
}

export function buildSkillRows(scores: Scores): SkillRow[] {
  return HORIZON_ORDER.map((h) => {
    const s = scores?.[h] ?? { n: 0 };
    if (!s.n) {
      return { horizon: h, label: HORIZON_LABEL[h], n: 0, hasData: false,
               crpss: "—", bss: "—", coverage: "—", abVerdict: "—" };
    }
    const cov = s.coverage == null ? "—"
      : `${Math.round(s.coverage * 100)}%${s.coverage_nominal != null ? ` (target ${Math.round(s.coverage_nominal * 100)}%)` : ""}`;
    let abVerdict = "—";
    if (s.ab && s.ab.model_brier != null && s.ab.baseline_brier != null) {
      const d = s.ab.baseline_brier - s.ab.model_brier;     // positive => overlay better
      abVerdict = d > 0.005 ? "Claude overlay beats baseline" : d < -0.005 ? "baseline beats overlay" : "overlay ≈ baseline";
    }
    return { horizon: h, label: HORIZON_LABEL[h], n: s.n, hasData: true,
             crpss: fmtSkill(s.crpss), bss: fmtSkill(s.bss), coverage: cov, abVerdict };
  });
}
```

```tsx
// components/SkillPanel.tsx
import type { Scores } from "@/lib/types";
import { buildSkillRows } from "@/lib/skill";

export function SkillPanel({ scores }: { scores: Scores }) {
  const rows = buildSkillRows(scores);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Calibration &amp; skill <span className="text-zinc-600">· proper scoring</span>
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr className="text-left">
              <th className="py-2 pr-3 font-medium">Horizon</th>
              <th className="py-2 pr-3 font-medium" title="Continuous Ranked Probability skill vs random walk; >0 = better">CRPS skill</th>
              <th className="py-2 pr-3 font-medium" title="Brier skill score vs random walk">Brier skill</th>
              <th className="py-2 pr-3 font-medium">Coverage</th>
              <th className="py-2 font-medium">Claude vs baseline</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.horizon} className="border-t border-zinc-800 text-zinc-200">
                <td className="py-2 pr-3">{r.label} {r.hasData && <span className="text-zinc-600">(N={r.n})</span>}</td>
                {r.hasData ? (
                  <>
                    <td className="py-2 pr-3">{r.crpss}</td>
                    <td className="py-2 pr-3">{r.bss}</td>
                    <td className="py-2 pr-3">{r.coverage}</td>
                    <td className="py-2 text-zinc-300">{r.abVerdict}</td>
                  </>
                ) : (
                  <td className="py-2 text-zinc-500" colSpan={4}>Not enough resolved forecasts yet</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        Skill scores near 0 mean ≈ a random walk — the honest expectation at short horizons. These fill in as forecasts mature.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests → PASS; `npx tsc --noEmit` → clean.**

- [ ] **Step 5: Commit**

```bash
git add web/lib/skill.ts web/components/SkillPanel.tsx web/lib/skill.test.ts web/components/SkillPanel.test.tsx
git commit -m "feat(web): calibration & skill panel (CRPSS/BSS/coverage/overlay-vs-baseline)"
```

---

### Task 4: "Your call vs the model" game (`lib/yourcall.ts`, `components/YourCall.tsx`)

**Files:**
- Create: `lib/yourcall.ts`, `components/YourCall.tsx`
- Test: `lib/yourcall.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/yourcall.test.ts
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
```

- [ ] **Step 2: Run test → FAIL** (`npm test -- lib/yourcall.test.ts`)

- [ ] **Step 3: Write the implementation**

```ts
// lib/yourcall.ts
export interface Call {
  id: string;
  createdAt: number;   // ms
  targetAt: number;    // ms (createdAt + 7 days)
  spotAtPick: number;
  userUp: boolean;
  modelPup: number;
}

export function priceAt(prices: { t: number; price: number }[], ts: number): number | null {
  for (const p of prices) if (p.t >= ts) return p.price;
  return null;
}

export function resolveCall(call: Call, prices: { t: number; price: number }[]) {
  const px = priceAt(prices, call.targetAt);
  if (px === null) return { resolved: false, actualUp: false, userRight: false, modelRight: false };
  const actualUp = px > call.spotAtPick;
  const modelUp = call.modelPup >= 0.5;
  return { resolved: true, actualUp, userRight: call.userUp === actualUp, modelRight: modelUp === actualUp };
}
```

```tsx
// components/YourCall.tsx
"use client";
import { useEffect, useState } from "react";
import { fetchActualPrices } from "@/lib/data";
import { resolveCall, type Call } from "@/lib/yourcall";

const KEY = "btc-oracle-calls-v1";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function load(): Call[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(calls: Call[]) { localStorage.setItem(KEY, JSON.stringify(calls)); }

export function YourCall({ spot, modelPup }: { spot: number | null; modelPup: number | null }) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [prices, setPrices] = useState<{ t: number; price: number }[]>([]);
  useEffect(() => { setCalls(load()); fetchActualPrices(60).then(setPrices); }, []);

  const makeCall = (userUp: boolean) => {
    if (!spot || modelPup === null) return;
    const now = Date.now();
    const next = [{ id: String(now), createdAt: now, targetAt: now + WEEK, spotAtPick: spot, userUp, modelPup }, ...calls].slice(0, 20);
    setCalls(next); save(next);
  };

  const resolved = calls.map((c) => ({ c, r: resolveCall(c, prices) })).filter((x) => x.r.resolved);
  const youHit = resolved.filter((x) => x.r.userRight).length;
  const modelHit = resolved.filter((x) => x.r.modelRight).length;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Your call vs. the model</h3>
      <p className="mt-2 text-sm text-zinc-400">Where do you think BTC is in 1 week — and can you beat the model? (Just for fun, stored only in your browser.)</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => makeCall(true)} className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/25">▲ Higher</button>
        <button onClick={() => makeCall(false)} className="rounded-md bg-rose-500/15 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/25">▼ Lower</button>
        {modelPup !== null && <span className="self-center text-xs text-zinc-500">model leans {modelPup >= 0.5 ? "higher" : "lower"} ({Math.round(modelPup * 100)}%)</span>}
      </div>
      {resolved.length > 0 && (
        <div className="mt-3 text-sm text-zinc-300">
          Resolved calls: <span className="text-zinc-100">you {youHit}/{resolved.length}</span> · <span className="text-zinc-100">model {modelHit}/{resolved.length}</span>
        </div>
      )}
      {calls.length > 0 && (
        <ul className="mt-2 divide-y divide-zinc-800 text-xs">
          {calls.slice(0, 6).map((c) => {
            const r = resolveCall(c, prices);
            const status = !r.resolved ? "pending" : r.userRight ? "✓ you were right" : "✗ you missed";
            return <li key={c.id} className="flex justify-between py-1.5 text-zinc-500">
              <span>you said {c.userUp ? "higher" : "lower"}</span><span className={r.resolved ? (r.userRight ? "text-emerald-400" : "text-rose-400") : "text-zinc-600"}>{status}</span>
            </li>;
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test → PASS; `npx tsc --noEmit` → clean.** (The component itself is verified by the page render test in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add web/lib/yourcall.ts web/components/YourCall.tsx web/lib/yourcall.test.ts
git commit -m "feat(web): 'your call vs the model' game (localStorage, self-resolving)"
```

---

### Task 5: About / Methodology page (`app/about/page.tsx`)

**Files:**
- Create: `app/about/page.tsx`

- [ ] **Step 1: Write the page** (static content; no test — verified by build)

```tsx
// app/about/page.tsx
import Link from "next/link";

export const metadata = { title: "About & Method · BTC Event Oracle" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-300">
      <Link href="/" className="text-sm text-[#f7931a]">← Back to the dashboard</Link>
      <h1 className="mt-4 text-3xl font-bold text-zinc-50">About &amp; method</h1>

      <p className="mt-3 text-sm leading-relaxed">
        BTC Event Oracle is an independent, non-commercial, educational project. It receives no
        compensation, promotes no products, and gives no personalized advice — it publishes one
        general, systematic forecast on a fixed hourly schedule. It is not financial advice.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-100">How the forecast is made</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Each hour a quantitative baseline estimates Bitcoin&apos;s volatility with a <strong>GJR-GARCH</strong>
        model (an asymmetric volatility model that out-performs simpler methods for crypto) and builds a
        central estimate, a confidence range, and a probability of being higher, for 1-week, 1-month, and
        1-year horizons. A <strong>volatility-regime</strong> check widens the published range during
        turbulent periods, when any model is less reliable. Then Claude (an LLM) reads condensed
        world-event signals — the Fear &amp; Greed index, perpetual funding, open interest, Deribit
        implied volatility, and news — and applies a <strong>small, hard-capped</strong> adjustment.
        If the model is unavailable, the site falls back to the untouched baseline.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-100">How it&apos;s graded</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Every forecast is scored when it comes due against a <strong>random-walk</strong> benchmark
        (&quot;tomorrow = today&quot;) using proper scoring rules — Brier score for direction, CRPS for the
        full price distribution, and interval coverage for the ranges — and we compare the Claude-adjusted
        forecast against the raw baseline. Skill scores near zero mean the method roughly ties a coin flip,
        which is the honest, expected result at short horizons. We publish the track record, N, and our
        misses openly.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-100">Honesty &amp; limits</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Nobody can reliably predict Bitcoin&apos;s price. This site exists to show a transparent method and
        hold it accountable — not to promise returns. Read the{" "}
        <Link href="/guide/" className="text-[#f7931a] underline">plain-English guide</Link> and the{" "}
        <Link href="/disclaimer/" className="text-[#f7931a] underline">full disclaimer</Link>.
      </p>

      <div className="mt-10 border-t border-zinc-800 pt-5">
        <Link href="/" className="text-sm text-[#f7931a]">← Back to the dashboard</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → succeeds; `out/about/index.html` exists.

- [ ] **Step 3: Commit**

```bash
git add web/app/about/page.tsx
git commit -m "feat(web): About & Method page"
```

---

### Task 6: Wire it into the page (`app/page.tsx`)

**Files:**
- Overwrite: `app/page.tsx`
- Modify: `app/page.test.tsx`

- [ ] **Step 1: Update the page test** (add markets + regime + skill assertions)

Edit `app/page.test.tsx`: in the `fetchSnapshots` mock's `latest`, add
`regime: { label: "elevated", percentile: 0.7 }` and
`markets: [{ question: "Will Bitcoin be above $62,000 on June 4?", yes_prob: 0.58, end_date: "x" }]`.
Add these assertions inside the existing `it(...)` after load:
```tsx
    expect(screen.getByText(/real-money markets imply/i)).toBeInTheDocument();
    expect(screen.getByText(/calibration & skill/i)).toBeInTheDocument();
    expect(screen.getByText(/your call vs\. the model/i)).toBeInTheDocument();
    expect(screen.getByText(/intervals modestly widened/i)).toBeInTheDocument();   // regime note
```

- [ ] **Step 2: Run test → FAIL** (`npm test -- app/page.test.tsx`)

- [ ] **Step 3: Write the implementation** (replace `app/page.tsx`)

Add imports (with the others): `MarketsPanel`, `SkillPanel`, `YourCall`, and `regimeNote` from `@/lib/format`.
After the `<Header .../>` line, the page already renders the guide link + stale banner. Add a **regime
note banner** right after the stale banner block:
```tsx
      {latest?.regime && regimeNote(latest.regime.label) && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
          ⚠ {regimeNote(latest.regime.label)}
        </div>
      )}
```
Then, inside the `{latest && (...)}` block, replace the final two `<section>`s (scorecard/calls and
timeline/news) with this expanded layout that adds Markets, Skill, and YourCall:
```tsx
          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {scores && <Scorecard scores={scores} />}
              {scores && <SkillPanel scores={scores} />}
              {extras && <RecentCalls results={extras.results} />}
            </div>
            <div className="space-y-4">
              <MarketsPanel markets={latest.markets ?? []} />
              <YourCall spot={price ?? latest.spot} modelPup={sortForecasts(latest.forecasts).find((f) => f.horizon === "1w")?.p_up ?? null} />
              {extras && <MindTimeline timeline={extras.timeline} />}
              <NewsFeed news={latest.news ?? []} />
            </div>
          </section>
```
(Keep the existing signals/dial section, horizon cards section, and chart/rationale section unchanged.
Add a small footer link to About: in the `<Disclaimer />` area is fine, OR add `<Link href="/about/">About &amp; method</Link>` near the guide link — add it to the guide-link row's right side is optional; at minimum ensure `/about/` is reachable, which it is as a route.)

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Full suite + build**

Run: `npm test` → PASS (all web tests). Run: `npm run build` → succeeds; `out/index.html` + `out/about/index.html` exist.

- [ ] **Step 6: Commit**

```bash
git add web/app/page.tsx web/app/page.test.tsx
git commit -m "feat(web): surface regime, markets, skill panel, and your-call game on the page"
```

---

## Self-Review

**1. Coverage:** regime indicator (Task 1/6), DVOL nicer label (Task 1), markets panel (Task 2),
calibration & skill panel incl CRPSS/BSS/coverage-vs-nominal/A/B with insufficient-data state (Task 3),
"your call vs model" localStorage game self-resolving via CoinGecko (Task 4), About/Method page (Task 5),
all wired (Task 6). Everything null/empty-safe (`?? []`, `?? null`, `{n:0}` paths, `regimeNote` returns
"" for normal). The basic `Scorecard` (buildScoreRows) is kept alongside the new `SkillPanel`.

**2. Placeholder scan:** No TBD/TODO; complete component + helper code; explicit test/build steps. The
About page and YourCall component are verified via build + the page render test rather than isolated RTL
(localStorage/fetch timing), a stated boundary.

**3. Type consistency:** `Market`/`Regime` (Task 1) → `MarketsPanel` (Task 2) + page. `ScoreH` new keys
(Task 1) → `buildSkillRows`/`SkillPanel` (Task 3). `regimeNote(label)->string` (Task 1) used in page +
tested. `Call`/`priceAt`/`resolveCall` (Task 4) → `YourCall` (Task 4). `signalDisplay` DVOL case is
consumed by the existing `SignalsStrip`. Page passes `markets={latest.markets ?? []}`,
`scores`/`extras` (already fetched via `useLiveData`), and `YourCall` gets `spot`/`modelPup` from the 1w
forecast. `app/page.test.tsx` mock includes `regime`+`markets` so the new components render.

---

## Next (final small pass)
- **Engine OG share cards** (Pillow-rendered hourly card → pushed to host; `og:image` meta), **RSS feed** (`rss.xml` of forecasts), and a **homepage at the domain root** (replace the Namecheap parking page with a simple landing page linking to /btc).

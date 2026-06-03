# BTC Oracle — Dashboard Live Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard feel alive using the new real data: a **market-signals strip** (Fear & Greed, funding, open interest, news tone), a **Bitcoin news feed** (RSS headlines with relative time), a **ticking live BTC price** that flashes green/red on change, and **60-second auto-refresh** with a pulsing "LIVE · updated Xs ago" indicator.

**Architecture:** Extend the typed `lib/` (Signal/NewsItem types, `relativeTime`, `signalDisplay`, `priceDirection`) with Vitest unit tests, add presentational `SignalsStrip`/`NewsFeed` components, add small client hooks (`useLivePrice` polling 15s, `useLiveData` re-fetching 60s), and wire them into the existing Layout-A page + Header. All pure logic is unit-tested; interval/animation behavior is verified by the page render test + build. This is the dashboard half of the "more action" upgrade.

**Working directory for ALL tasks:** `C:\Users\GamerTech\btc-oracle\web`. Bash: `cd /c/Users/GamerTech/btc-oracle/web && ...`. Tests: `npm test -- <file>`. Build: `npm run build`. Type-check: `npx tsc --noEmit`. Git: from repo root `cd /c/Users/GamerTech/btc-oracle`. Alias `@/*` → `web/`.

**Verified new data (real engine output, in `web/public/data/latest.json`):**
```jsonc
"signals": [
  { "source": "fng",     "signal": "fear_greed",    "value": 11.0,      "delta": -12.0, "interpretation": "Fear & Greed 11/100 (Extreme Fear), -12 vs prior reading", "observed_at": "..." },
  { "source": "funding", "signal": "funding_rate",  "value": 8.14e-05,  "delta": null,  "interpretation": "Perp funding +0.0081% — longs pay shorts (crowded long)", "observed_at": "..." },
  { "source": "oi",      "signal": "open_interest", "value": 58472.864, "delta": null,  "interpretation": "BTC perp open interest 58,473 contracts", "observed_at": "..." }
  // gdelt 'news_tone' may also appear (value=tone, delta vs avg) — strip must render a VARIABLE set of signals
],
"news": [
  { "title": "Bitmine's Ethereum bet nears $9 billion loss...", "url": "https://...", "source": "CoinDesk", "published_at": "2026-06-03T20:33:51+00:00" }
  // 12 items, newest-first
]
```

**Existing (do not break):** `lib/types`, `lib/format`, `lib/data.fetchSnapshots/fetchLiveSpot`, `components/{HorizonCard,Scorecard,ForecastChart,Header,RationalePanel,Disclaimer}`, `app/page.tsx`.

---

## File structure (under `web/`)
```
lib/types.ts        # + Signal, NewsItem; extend Latest with signals?/news?
lib/format.ts       # + relativeTime(), signalDisplay()
lib/hooks.ts        # priceDirection() (pure), useLivePrice(), useLiveData()
components/SignalsStrip.tsx
components/NewsFeed.tsx
components/Header.tsx   # (overwrite) ticking price + flash + LIVE pulse + updated-ago
app/page.tsx           # (overwrite) integrate strip + feed + auto-refresh
tests: lib/format.test.ts (extend), lib/hooks.test.ts, components/SignalsStrip.test.tsx,
       components/NewsFeed.test.tsx, app/page.test.tsx (extend)
```

---

### Task 1: Types + signal/time formatters (`lib/types.ts`, `lib/format.ts`)

**Files:**
- Modify: `lib/types.ts`, `lib/format.ts`
- Test: `lib/format.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append to existing file)

```tsx
// lib/format.test.ts  (add these)
import { relativeTime, signalDisplay } from "@/lib/format";
import type { Signal } from "@/lib/types";

describe("relativeTime", () => {
  const now = Date.parse("2026-06-03T21:00:00Z");
  it("formats recent times", () => {
    expect(relativeTime("2026-06-03T20:59:30+00:00", now)).toBe("just now");
    expect(relativeTime("2026-06-03T20:45:00+00:00", now)).toBe("15m ago");
    expect(relativeTime("2026-06-03T18:00:00+00:00", now)).toBe("3h ago");
  });
  it("handles empty/invalid", () => {
    expect(relativeTime("", now)).toBe("");
  });
});

describe("signalDisplay", () => {
  const mk = (signal: string, value: number | null, delta: number | null, interp = ""): Signal =>
    ({ source: "x", signal, value, delta, interpretation: interp, observed_at: "" });
  it("formats fear & greed with a fear tone", () => {
    const d = signalDisplay(mk("fear_greed", 11, -12, "Extreme Fear"));
    expect(d.label).toBe("Fear & Greed");
    expect(d.value).toBe("11/100");
    expect(d.tone).toBe("fear");
  });
  it("formats funding as a signed percent", () => {
    const d = signalDisplay(mk("funding_rate", 0.0000814, null));
    expect(d.label).toBe("Perp funding");
    expect(d.value).toBe("+0.0081%");
    expect(d.tone).toBe("up");
  });
  it("formats open interest with separators", () => {
    const d = signalDisplay(mk("open_interest", 58472.86, null));
    expect(d.value).toBe("58,473");
  });
  it("falls back for unknown signals", () => {
    const d = signalDisplay(mk("mystery", 5, null, "hmm"));
    expect(d.label).toBe("mystery");
    expect(d.tone).toBe("neutral");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/format.test.ts`
Expected: FAIL — `relativeTime`/`signalDisplay` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/types.ts`:
```ts
export interface Signal {
  source: string;
  signal: string;
  value: number | null;
  delta: number | null;
  interpretation: string;
  observed_at: string;
}
export interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
}
```
And add the two optional fields to the existing `Latest` interface:
```ts
// in interface Latest { ... } add:
  signals?: Signal[];
  news?: NewsItem[];
```

Append to `lib/format.ts`:
```ts
import type { Signal } from "./types";

export function relativeTime(iso: string, now: number = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export type SignalTone = "fear" | "greed" | "up" | "down" | "neutral";
export interface SignalDisplay {
  label: string;
  value: string;
  delta: string | null;
  hint: string;
  tone: SignalTone;
}

export function signalDisplay(s: Signal): SignalDisplay {
  const v = s.value ?? 0;
  const delta =
    s.delta === null || s.delta === undefined
      ? null
      : `${s.delta >= 0 ? "+" : ""}${Math.round(s.delta)}`;
  switch (s.signal) {
    case "fear_greed":
      return {
        label: "Fear & Greed", value: `${Math.round(v)}/100`, delta,
        hint: s.interpretation, tone: v < 25 ? "fear" : v > 75 ? "greed" : "neutral",
      };
    case "funding_rate": {
      const pct = v * 100;
      return {
        label: "Perp funding", value: `${pct >= 0 ? "+" : ""}${pct.toFixed(4)}%`, delta,
        hint: s.interpretation, tone: pct >= 0 ? "up" : "down",
      };
    }
    case "open_interest":
      return {
        label: "Open interest", value: Math.round(v).toLocaleString("en-US"), delta,
        hint: s.interpretation, tone: "neutral",
      };
    case "news_tone":
      return {
        label: "News tone", value: v.toFixed(2), delta,
        hint: s.interpretation, tone: v >= 0 ? "up" : "down",
      };
    default:
      return { label: s.signal, value: String(s.value ?? "—"), delta, hint: s.interpretation, tone: "neutral" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/format.test.ts`
Expected: PASS (original + new tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/lib/format.ts web/lib/format.test.ts
git commit -m "feat(web): Signal/NewsItem types + relativeTime + signalDisplay"
```

---

### Task 2: SignalsStrip component (`components/SignalsStrip.tsx`)

**Files:**
- Create: `components/SignalsStrip.tsx`
- Test: `components/SignalsStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/SignalsStrip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalsStrip } from "@/components/SignalsStrip";
import type { Signal } from "@/lib/types";

const signals: Signal[] = [
  { source: "fng", signal: "fear_greed", value: 11, delta: -12, interpretation: "Extreme Fear", observed_at: "" },
  { source: "funding", signal: "funding_rate", value: 0.0000814, delta: null, interpretation: "crowded long", observed_at: "" },
  { source: "oi", signal: "open_interest", value: 58472, delta: null, interpretation: "contracts", observed_at: "" },
];

describe("SignalsStrip", () => {
  it("renders a tile per signal with label + value", () => {
    render(<SignalsStrip signals={signals} />);
    expect(screen.getByText("Fear & Greed")).toBeInTheDocument();
    expect(screen.getByText("11/100")).toBeInTheDocument();
    expect(screen.getByText("+0.0081%")).toBeInTheDocument();
    expect(screen.getByText("58,473")).toBeInTheDocument();
  });
  it("renders nothing when there are no signals", () => {
    const { container } = render(<SignalsStrip signals={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/SignalsStrip.test.tsx`
Expected: FAIL — cannot resolve `@/components/SignalsStrip`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/SignalsStrip.tsx
import type { Signal } from "@/lib/types";
import { signalDisplay, type SignalTone } from "@/lib/format";

const TONE: Record<SignalTone, string> = {
  fear: "text-rose-300",
  down: "text-rose-300",
  greed: "text-emerald-300",
  up: "text-emerald-300",
  neutral: "text-zinc-100",
};

export function SignalsStrip({ signals }: { signals: Signal[] }) {
  if (!signals || signals.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        What the model is watching
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {signals.map((s) => {
          const d = signalDisplay(s);
          return (
            <div key={s.source + s.signal} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                 title={d.hint}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{d.label}</span>
                {d.delta && (
                  <span className={`text-xs ${d.delta.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>
                    {d.delta}
                  </span>
                )}
              </div>
              <div className={`mt-1 text-xl font-bold ${TONE[d.tone]}`}>{d.value}</div>
              <div className="mt-1 truncate text-xs text-zinc-600">{d.hint}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/SignalsStrip.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/SignalsStrip.tsx web/components/SignalsStrip.test.tsx
git commit -m "feat(web): SignalsStrip (live Fear&Greed/funding/OI/tone tiles)"
```

---

### Task 3: NewsFeed component (`components/NewsFeed.tsx`)

**Files:**
- Create: `components/NewsFeed.tsx`
- Test: `components/NewsFeed.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/NewsFeed.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsFeed } from "@/components/NewsFeed";
import type { NewsItem } from "@/lib/types";

const news: NewsItem[] = [
  { title: "Bitcoin tags new high", url: "https://x.com/a", source: "CoinDesk", published_at: "2026-06-03T20:33:51+00:00" },
  { title: "Ether slips below 1800", url: "https://x.com/b", source: "Cointelegraph", published_at: "2026-06-03T16:09:12+00:00" },
];

describe("NewsFeed", () => {
  it("renders headlines as links with source", () => {
    render(<NewsFeed news={news} />);
    const link = screen.getByRole("link", { name: /Bitcoin tags new high/ });
    expect(link).toHaveAttribute("href", "https://x.com/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/CoinDesk/)).toBeInTheDocument();
  });
  it("shows an empty state when no news", () => {
    render(<NewsFeed news={[]} />);
    expect(screen.getByText(/no headlines/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/NewsFeed.test.tsx`
Expected: FAIL — cannot resolve `@/components/NewsFeed`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/NewsFeed.tsx
"use client";
import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";
import { relativeTime } from "@/lib/format";

export function NewsFeed({ news }: { news: NewsItem[] }) {
  // re-tick relative timestamps every 30s so "Xm ago" stays honest
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Latest Bitcoin headlines
      </h3>
      {(!news || news.length === 0) ? (
        <p className="mt-3 text-sm text-zinc-600">No headlines right now.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-800">
          {news.map((n, i) => (
            <li key={n.url + i} className="py-2.5">
              <a href={n.url} target="_blank" rel="noopener noreferrer"
                 className="text-sm text-zinc-200 hover:text-[#f7931a]">
                {n.title}
              </a>
              <div className="mt-0.5 text-xs text-zinc-500">
                {n.source}
                {n.published_at && <> · {relativeTime(n.published_at, now)}</>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/NewsFeed.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/NewsFeed.tsx web/components/NewsFeed.test.tsx
git commit -m "feat(web): NewsFeed (RSS headlines with live relative time)"
```

---

### Task 4: Live hooks (`lib/hooks.ts`)

**Files:**
- Create: `lib/hooks.ts`
- Test: `lib/hooks.test.ts`

- [ ] **Step 1: Write the failing test** (the pure direction helper)

```ts
// lib/hooks.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/hooks.test.ts`
Expected: FAIL — cannot resolve `@/lib/hooks`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/hooks.ts
"use client";
import { useEffect, useRef, useState } from "react";
import type { Latest, History, Scores } from "./types";
import { fetchSnapshots, fetchLiveSpot } from "./data";

export type Dir = "up" | "down" | "flat";

export function priceDirection(prev: number | null, next: number): Dir {
  if (prev === null || prev === undefined) return "flat";
  if (next > prev) return "up";
  if (next < prev) return "down";
  return "flat";
}

/** Poll the live BTC spot every `ms`, exposing the latest price + tick direction. */
export function useLivePrice(ms = 15_000): { price: number | null; dir: Dir } {
  const [price, setPrice] = useState<number | null>(null);
  const [dir, setDir] = useState<Dir>("flat");
  const prev = useRef<number | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const p = await fetchLiveSpot();
      if (!alive || p === null) return;
      setDir(priceDirection(prev.current, p));
      prev.current = p;
      setPrice(p);
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ms]);
  return { price, dir };
}

export interface LiveData {
  latest: Latest | null;
  history: History | null;
  scores: Scores | null;
  error: string | null;
  updatedAt: number | null;
}

/** Fetch the snapshots on mount and re-fetch every `ms` so new hourly runs appear. */
export function useLiveData(ms = 60_000): LiveData {
  const [data, setData] = useState<LiveData>({
    latest: null, history: null, scores: null, error: null, updatedAt: null,
  });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { latest, history, scores } = await fetchSnapshots();
        if (!alive) return;
        setData({ latest, history, scores, error: null, updatedAt: Date.now() });
      } catch (e) {
        if (alive) setData((d) => ({ ...d, error: String(e) }));
      }
    };
    load();
    const id = setInterval(load, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ms]);
  return data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/hooks.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/hooks.ts web/lib/hooks.test.ts
git commit -m "feat(web): live hooks — useLivePrice (15s) and useLiveData (60s)"
```

---

### Task 5: Wire it together — Header + page (`components/Header.tsx`, `app/page.tsx`)

**Files:**
- Overwrite: `components/Header.tsx`, `app/page.tsx`
- Modify: `app/page.test.tsx` (extend)

- [ ] **Step 1: Write the failing test** (extend the page test to assert signals + news + LIVE)

```tsx
// app/page.test.tsx  — REPLACE the file with this version
import { describe, it, expect, vi } from "vitest";
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
      signals: [
        { source: "fng", signal: "fear_greed", value: 11, delta: -12, interpretation: "Extreme Fear", observed_at: "" },
      ],
      news: [
        { title: "Bitmine ETH loss widens", url: "https://x.com/a", source: "CoinDesk", published_at: "2026-06-03T20:00:00+00:00" },
      ],
    },
    history: { "1w": [], "1m": [], "1y": [] },
    scores: { "1w": { n: 0 }, "1m": { n: 0 }, "1y": { n: 0 } },
  })),
  fetchLiveSpot: vi.fn(async () => 65300),
}));

describe("Dashboard page", () => {
  it("renders cards, signals, news and a LIVE indicator after load", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("1 Week")).toBeInTheDocument());
    expect(screen.getByText("1 Month")).toBeInTheDocument();
    expect(screen.getByText("1 Year")).toBeInTheDocument();
    expect(screen.getByText(/Extreme Fear drives caution/)).toBeInTheDocument();
    expect(screen.getAllByText(/insufficient data/i).length).toBe(3);
    // new live elements
    expect(screen.getByText("Fear & Greed")).toBeInTheDocument();
    expect(screen.getByText(/Bitmine ETH loss widens/)).toBeInTheDocument();
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/page.test.tsx`
Expected: FAIL — current page has no SignalsStrip/NewsFeed/LIVE.

- [ ] **Step 3: Write the implementation**

`components/Header.tsx` (replace entire file — ticking price, flash, LIVE pulse, updated-ago):
```tsx
import type { Latest } from "@/lib/types";
import type { Dir } from "@/lib/hooks";
import { fmtUsd, fmtDateTime, relativeTime } from "@/lib/format";

const FLASH: Record<Dir, string> = {
  up: "text-emerald-400",
  down: "text-rose-400",
  flat: "text-zinc-50",
};

export function Header({
  latest, livePrice, dir, updatedAt, now,
}: {
  latest: Latest | null;
  livePrice: number | null;
  dir: Dir;
  updatedAt: number | null;
  now: number;
}) {
  const price = livePrice ?? latest?.spot ?? null;
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
            An honest, hourly Bitcoin forecast driven by world events — and held accountable
            against a random-walk benchmark. Not a crystal ball; a tracked method.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Live BTC</div>
          <div className={`text-2xl font-bold tabular-nums transition-colors duration-300 ${FLASH[dir]}`}>
            {price ? fmtUsd(price) : "—"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">forecast as of {fmtDateTime(latest?.run_at ?? null)}</div>
          <div className="mt-1 flex items-center justify-end gap-2">
            {updatedAt && <span className="text-[11px] text-zinc-600">updated {relativeTime(new Date(updatedAt).toISOString(), now)}</span>}
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

`app/page.tsx` (replace entire file):
```tsx
"use client";
import { useEffect, useState } from "react";
import { sortForecasts } from "@/lib/format";
import { useLiveData, useLivePrice } from "@/lib/hooks";
import { Header } from "@/components/Header";
import { SignalsStrip } from "@/components/SignalsStrip";
import { HorizonCard } from "@/components/HorizonCard";
import { ForecastChart } from "@/components/ForecastChart";
import { Scorecard } from "@/components/Scorecard";
import { RationalePanel } from "@/components/RationalePanel";
import { NewsFeed } from "@/components/NewsFeed";
import { Disclaimer } from "@/components/Disclaimer";

export default function Page() {
  const { latest, history, scores, error, updatedAt } = useLiveData(60_000);
  const { price, dir } = useLivePrice(15_000);

  // tick a clock every 15s so "updated Xs ago" / relative times stay fresh
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Header latest={latest} livePrice={price} dir={dir} updatedAt={updatedAt} now={now} />

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Couldn&apos;t load forecast data ({error}).
        </div>
      )}
      {!latest && !error && (
        <div className="mt-10 text-center text-zinc-500">Loading the latest forecast…</div>
      )}

      {latest && (
        <>
          <SignalsStrip signals={latest.signals ?? []} />

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortForecasts(latest.forecasts).map((f) => (
              <HorizonCard key={f.horizon} f={f} />
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">{history && <ForecastChart history={history} />}</div>
            <RationalePanel latest={latest} />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">{scores && <Scorecard scores={scores} />}</div>
            <NewsFeed news={latest.news ?? []} />
          </section>
        </>
      )}

      <Disclaimer />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full test suite + production build**

Run: `npm test`
Expected: PASS (all web tests).
Run: `npm run build`
Expected: static export succeeds; `out/index.html` exists.

- [ ] **Step 6: Commit**

```bash
git add web/components/Header.tsx web/app/page.tsx web/app/page.test.tsx
git commit -m "feat(web): wire signals strip, news feed, ticking price + LIVE auto-refresh"
```

---

## Self-Review

**1. Coverage:** signals strip (Task 2, fed by §signals), news feed (Task 3, RSS), ticking/flashing live price (Header + `useLivePrice`, Tasks 4–5), 60s auto-refresh + "LIVE" pulse + updated-ago (`useLiveData` + Header, Tasks 4–5). All consume the real new `latest.json` fields; `signals ?? []` / `news ?? []` keep it safe if absent.

**2. Placeholder scan:** No TBD/TODO; complete component + hook code; explicit test/build commands. Interval-driven behavior is verified by the page render test (asserts signals + news + LIVE) + `npm run build`, with the pure `priceDirection`/`relativeTime`/`signalDisplay` unit-tested directly — a deliberate, stated testing boundary.

**3. Type consistency:** `Signal`/`NewsItem` (Task 1) flow into `signalDisplay` (Task 1) → `SignalsStrip` (Task 2) and `NewsFeed` (Task 3). `Latest.signals?/news?` (Task 1) are read in `app/page.tsx` (Task 5) as `latest.signals ?? []`. `useLivePrice(): {price, dir}` and `useLiveData(): {latest,history,scores,error,updatedAt}` (Task 4) match the page's destructuring and `Header`'s props `{latest, livePrice, dir, updatedAt, now}` (Task 5). `priceDirection` and `relativeTime` signatures match their tests.

---

## Next plan
- **cPanel deploy** — push the static export into `public_html`, install the engine + hourly cron running `btc-oracle run`, set secrets in a gitignored `.env`, verify https://vadym.online, rotate the cPanel password.

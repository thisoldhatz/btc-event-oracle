// components/ForecastChart.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { History, Horizon } from "@/lib/types";
import { toBandSeries, mergeActual, type MergedPoint } from "@/lib/chart";
import { fetchActualPrices } from "@/lib/data";
import { HORIZON_ORDER, HORIZON_LABEL, fmtUsd } from "@/lib/format";

const DAYS: Record<Horizon, number> = { "1w": 14, "1m": 45, "1y": 365 };

const GRID = "#26262E";      // hairline grid
const TICK = "#6B6B76";      // axis ticks (text-faint)
const IDEAL = "#5B5B66";     // reference / random-walk dashed
const ORANGE = "#F7931A";    // forecast (accent)
const SLATE = "#7CA9D8";     // actual (text-cool / reality)

/** Custom dark tooltip — bg-surface, keyline border, mono numbers, paired with
 *  a coloured glyph so meaning never relies on hue alone. */
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { dataKey?: string | number; value?: number }[]; label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const central = get("central");
  const lower = get("lower");
  const band = get("band");
  const upper = typeof lower === "number" && typeof band === "number" ? lower + band : undefined;
  const actual = get("actual");
  const when = typeof label === "number"
    ? new Date(label).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div className="rounded-md border border-keyline bg-surface px-3 py-2 shadow-lg">
      <div className="font-mono text-[10px] uppercase tracking-wide text-faint">{when}</div>
      <div className="mt-1.5 space-y-1 font-mono text-xs tnum">
        {typeof central === "number" && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-accent">— forecast</span>
            <span className="text-ink">{fmtUsd(central)}</span>
          </div>
        )}
        {typeof lower === "number" && typeof upper === "number" && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-faint">range</span>
            <span className="text-muted">{fmtUsd(lower)} – {fmtUsd(upper)}</span>
          </div>
        )}
        {typeof actual === "number" && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-cool">— actual</span>
            <span className="text-ink">{fmtUsd(actual)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Act III — "Forecast vs reality". The forecast band (orange wash) and central
 *  line read first; the actual price (slate) is the truth it's measured against;
 *  a dashed "random walk" line shows the no-change baseline we roughly tie. */
export function ForecastChart({ history }: { history: History }) {
  const [h, setH] = useState<Horizon>("1w");
  const [actual, setActual] = useState<{ t: number; price: number }[]>([]);

  useEffect(() => {
    let alive = true;
    fetchActualPrices(DAYS[h]).then((p) => alive && setActual(p));
    return () => { alive = false; };
  }, [h]);

  const data: MergedPoint[] = useMemo(
    () => mergeActual(toBandSeries(history[h] ?? []), actual),
    [history, h, actual],
  );

  // Random-walk ("no change") baseline: the latest observed spot, falling back
  // to the earliest forecast central if no actuals have loaded yet.
  const randomWalk = useMemo(() => {
    for (let i = data.length - 1; i >= 0; i--) {
      const a = data[i].actual;
      if (typeof a === "number") return a;
    }
    const firstCentral = data.find((d) => typeof d.central === "number");
    return firstCentral?.central ?? null;
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-5">
          {HORIZON_ORDER.map((opt) => {
            const active = opt === h;
            return (
              <button
                key={opt}
                onClick={() => setH(opt)}
                aria-pressed={active}
                className={`pb-1 font-body text-sm transition-colors ${
                  active
                    ? "border-b-2 border-accent text-ink"
                    : "border-b-2 border-transparent text-faint hover:text-muted"
                }`}
              >
                {HORIZON_LABEL[opt]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4 bg-accent" aria-hidden /> forecast
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4 bg-cool" aria-hidden /> actual
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-keyline bg-sunken p-3">
        <div className="h-72">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center font-mono text-[13px] text-faint">
              not enough resolved forecasts yet — this fills in as calls mature.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 8 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time"
                  tickFormatter={(t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  stroke={GRID} tick={{ fill: TICK, fontSize: 11, fontFamily: "var(--font-mono)" }}
                  tickLine={{ stroke: GRID }} axisLine={{ stroke: GRID }}
                />
                <YAxis
                  tickFormatter={(v) => fmtUsd(v)} width={70} domain={["auto", "auto"]}
                  stroke={GRID} tick={{ fill: TICK, fontSize: 11, fontFamily: "var(--font-mono)" }}
                  tickLine={{ stroke: GRID }} axisLine={{ stroke: GRID }}
                />
                <Tooltip cursor={{ stroke: GRID, strokeWidth: 1 }} content={<ChartTooltip />} />

                {/* forecast band: lower (invisible base) + band (orange wash) stacked */}
                <Area
                  dataKey="lower" stackId="band" stroke="none" fill="transparent"
                  isAnimationActive={false} connectNulls
                />
                <Area
                  dataKey="band" stackId="band" stroke="none" fill={ORANGE} fillOpacity={0.12}
                  isAnimationActive={false} connectNulls
                />

                {/* random-walk (no-change) baseline — the coin-flip we roughly tie */}
                {randomWalk != null && (
                  <ReferenceLine
                    y={randomWalk} stroke={IDEAL} strokeWidth={1} strokeDasharray="4 4"
                    label={{
                      value: "random walk (no change)", position: "insideTopLeft",
                      fill: TICK, fontSize: 10, fontFamily: "var(--font-mono)",
                    }}
                  />
                )}

                <Line
                  dataKey="central" stroke={ORANGE} dot={false} strokeWidth={2}
                  isAnimationActive={false} connectNulls
                />
                <Line
                  dataKey="actual" stroke={SLATE} dot={false} strokeWidth={2}
                  isAnimationActive={false} connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p className="mt-3 max-w-measure font-mono text-[11px] leading-relaxed text-faint">
        Orange is the {HORIZON_LABEL[h]} forecast — the wash is its range, the line its central guess.
        Slate is the actual BTC price. The dashed line is &ldquo;no change&rdquo; — over short horizons we
        expect to roughly tie it, and the point of this chart is to show that honestly.
      </p>
    </div>
  );
}

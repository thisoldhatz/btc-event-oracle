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

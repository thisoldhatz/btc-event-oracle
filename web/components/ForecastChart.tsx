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

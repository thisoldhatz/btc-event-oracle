"use client";
import {
  Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

/** PIT (probability-integral-transform) histogram. If the model's intervals are
 *  well-calibrated, outcomes land uniformly across the [0,1] bins — so a FLAT
 *  profile (every bar near the dashed "uniform" line) is the good result. Bars
 *  are deliberately neutral, never accent/up/down, because no single bin is a
 *  "win"; only the overall flatness matters. */
export function PitHistogram({ bins, n }: { bins: { lo: number; hi: number; freq: number }[]; n: number }) {
  // Honest empty state: PIT is meaningless until enough forecasts have resolved.
  if (n < 10 || bins.length === 0) {
    return (
      <figure className="anim-fade-in">
        <div className="flex h-[240px] items-center justify-center rounded-sm border border-dashed border-keyline bg-sunken px-6 text-center">
          <p className="max-w-measure font-body text-sm leading-relaxed text-muted">
            Not enough resolved forecasts yet to test calibration.
            <span className="mt-1 block font-mono text-[11px] text-faint">
              {n} of 10 needed — this fills in as calls mature.
            </span>
          </p>
        </div>
        <figcaption className="mt-2 font-mono text-[11px] text-faint">
          Probability-integral-transform of outcomes — flat = well-calibrated intervals.
        </figcaption>
      </figure>
    );
  }

  const uniform = 1 / bins.length;
  const data = bins.map((b) => ({
    label: `${b.lo.toFixed(1)}–${b.hi.toFixed(1)}`,
    freq: b.freq,
  }));

  return (
    <figure className="anim-fade-up">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke="#26262E" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#26262E"
              tick={{ fill: "#6B6B76", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              stroke="#26262E"
              tick={{ fill: "#6B6B76", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              width={40}
              tickFormatter={(v: number) => v.toFixed(2)}
              domain={[0, "auto"]}
            />
            <Tooltip
              cursor={{ fill: "#6B6B76", fillOpacity: 0.06 }}
              contentStyle={{
                background: "#16161B",
                border: "1px solid #26262E",
                borderRadius: 4,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
              labelStyle={{ color: "#6B6B76" }}
              itemStyle={{ color: "#C9C9C2" }}
              formatter={(v) => [typeof v === "number" ? v.toFixed(3) : "—", "frequency"]}
              labelFormatter={(l) => `bin ${l}`}
            />
            <ReferenceLine
              y={uniform}
              stroke="#5B5B66"
              strokeDasharray="4 4"
              label={{
                value: "uniform = well-calibrated",
                position: "right",
                fill: "#6B6B76",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            />
            <Bar dataKey="freq" fill="#6B6B76" radius={[1, 1, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 font-mono text-[11px] text-faint">
        Probability-integral-transform of outcomes — flat = well-calibrated intervals.
      </figcaption>
    </figure>
  );
}

// Keep the recharts tooltip type import tree-shakeable & referenced (type-only).
export type PitTooltip = TooltipProps<number, string>;

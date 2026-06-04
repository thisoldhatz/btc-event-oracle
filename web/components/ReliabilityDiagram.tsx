"use client";
import {
  ResponsiveContainer, ScatterChart, Scatter, Cell, XAxis, YAxis,
  ZAxis, CartesianGrid, ReferenceLine, Tooltip,
} from "recharts";
import type { TooltipProps } from "recharts";
import { fmtPct } from "@/lib/format";

type Point = { p: number; o: number; n: number };

const ORANGE = "#F7931A";
const IDEAL = "#5B5B66";
const GRID = "#26262E";
const AXIS = "#6B6B76";

/** Tooltip on bg-surface with a keyline border and mono numbers. Meaning never
 *  rides on hue alone — the plain-English "we said X → happened Y" carries it. */
function CalTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload as Point | undefined;
  if (!d) return null;
  const beats = d.o >= d.p; // observed at-or-above what we claimed
  return (
    <div className="rounded-sm border border-keyline bg-surface px-3 py-2 shadow-lg">
      <div className="font-mono text-[11px] text-muted tnum">
        we said <span className="text-accent">{fmtPct(d.p)}</span>
      </div>
      <div className="font-mono text-[11px] text-muted tnum">
        it happened{" "}
        <span className={beats ? "text-up" : "text-down"}>
          <span aria-hidden>{beats ? "▲" : "▼"}</span> {fmtPct(d.o)}
        </span>
      </div>
      <div className="mt-1 font-mono text-[10px] text-faint tnum">
        from {d.n} resolved call{d.n === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/** Reliability (calibration) diagram. A square scatter of forecast P(up) vs the
 *  observed up-rate, against a dashed 45° "perfect calibration" line — so the
 *  eye reads "do our 60%s actually happen 60% of the time?" before any verdict.
 *  Orange dots = our scored claims; the slate dashes are the ideal, never us. */
export function ReliabilityDiagram({ points }: { points: Point[] }) {
  // Keep only finite, in-range bins; size by sample count.
  const pts = (points ?? []).filter(
    (d) =>
      Number.isFinite(d.p) && Number.isFinite(d.o) && Number.isFinite(d.n) &&
      d.n > 0 && d.p >= 0 && d.p <= 1 && d.o >= 0 && d.o <= 1,
  );

  // Honest empty/insufficient state — fewer than 2 bins can't show a trend.
  if (pts.length < 2) {
    return (
      <figure className="anim-fade-up anim-delay-1">
        <div
          className="flex h-[240px] items-center justify-center rounded-sm border border-dashed border-keyline bg-sunken px-6 text-center"
          role="img"
          aria-label="Reliability diagram: not enough resolved forecasts yet"
        >
          <p className="max-w-measure font-body text-sm leading-relaxed text-muted">
            Not enough resolved forecasts yet — the reliability diagram fills in
            as calls mature.
          </p>
        </div>
        <figcaption className="mt-2 font-mono text-[11px] text-faint">
          When we say 60%, it happens ~60% of the time — these dots show whether
          that&apos;s true.
        </figcaption>
      </figure>
    );
  }

  // Plot in issue order so the optional connecting path reads left-to-right.
  const data = [...pts].sort((a, b) => a.p - b.p);
  const maxN = Math.max(...data.map((d) => d.n));

  const pctTick = (v: number) => fmtPct(v);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="anim-fade-up anim-delay-1">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 4 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
            {/* Perfect calibration — the slate ideal, dashed, never "us". */}
            <ReferenceLine
              segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
              stroke={IDEAL}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              ifOverflow="visible"
            />
            <XAxis
              type="number"
              dataKey="p"
              domain={[0, 1]}
              ticks={ticks}
              tickFormatter={pctTick}
              tick={{ fill: AXIS, fontSize: 10, fontFamily: "var(--font-mono)" }}
              stroke={GRID}
              tickLine={{ stroke: GRID }}
            >
            </XAxis>
            <YAxis
              type="number"
              dataKey="o"
              domain={[0, 1]}
              ticks={ticks}
              tickFormatter={pctTick}
              tick={{ fill: AXIS, fontSize: 10, fontFamily: "var(--font-mono)" }}
              stroke={GRID}
              tickLine={{ stroke: GRID }}
              width={40}
            />
            {/* Dot area scales with how many resolved calls fed the bin. */}
            <ZAxis type="number" dataKey="n" domain={[0, maxN]} range={[44, 230]} />
            <Tooltip
              cursor={{ stroke: GRID }}
              content={<CalTooltip />}
              isAnimationActive={false}
            />
            <Scatter
              data={data}
              line={{ stroke: ORANGE, strokeWidth: 1, strokeOpacity: 0.4 }}
              lineType="joint"
              fill={ORANGE}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={ORANGE} fillOpacity={0.35 + 0.5 * (d.n / maxN)} stroke={ORANGE} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 font-mono text-[11px] text-faint">
        When we say 60%, it happens ~60% of the time — these dots show whether
        that&apos;s true.
      </figcaption>
    </figure>
  );
}

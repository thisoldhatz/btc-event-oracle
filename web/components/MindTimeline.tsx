// components/MindTimeline.tsx
"use client";
import { useState } from "react";
import type { TimelineItem } from "@/lib/types";
import { buildTimeline } from "@/lib/timeline";
import { fmtPct, fmtDateTime } from "@/lib/format";

/** A continuous editorial timeline of the model's own changes of mind. A single
 *  hairline runs down the left with small nodes; each entry is a mono dateline +
 *  P(up) with ▲/▼ in muted up/down. When the direction flips vs the prior entry
 *  an orange "changed direction" text tag appears (no fill — orange = a scored
 *  claim, used scarcely). Clicking an entry expands its rationale as indented
 *  serif-italic. ~50% reads as a coin-flip, never a confident call. */
export function MindTimeline({ timeline }: { timeline: TimelineItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const entries = buildTimeline(timeline).slice(0, 15);

  if (entries.length === 0) {
    return (
      <p className="max-w-measure font-body text-sm leading-relaxed text-muted">
        Not enough resolved forecasts yet — this timeline fills in as the hourly calls
        accumulate and the model revises itself.
      </p>
    );
  }

  return (
    <ol className="relative ml-1 border-l border-keyline">
      {entries.map((e, i) => {
        const coin = Math.abs(e.p_up - 0.5) < 0.04;
        const isOpen = open === i;
        return (
          <li key={`${e.run_at}-${i}`} className="relative pl-6">
            {/* node on the spine */}
            <span
              aria-hidden
              className={`absolute -left-[5px] top-[0.95rem] h-[9px] w-[9px] rounded-full border ${
                e.flipped ? "border-accent/60 bg-accent/30" : "border-keyline bg-sunken"
              }`}
            />
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="group flex w-full items-baseline justify-between gap-4 py-3 text-left"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="font-mono text-[11px] tnum text-faint">{fmtDateTime(e.run_at)}</span>
                {e.flipped && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
                    changed direction
                  </span>
                )}
                {!e.llm_applied && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                    quant only
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 font-mono text-sm tnum ${
                  coin ? "text-muted" : e.up ? "text-up" : "text-down"
                }`}
              >
                <span aria-hidden>{e.up ? "▲" : "▼"}</span>{" "}
                <span className="text-faint">P(up)</span> {fmtPct(e.p_up)}
                {coin && <span className="ml-1.5 text-[10px] text-faint">coin-flip</span>}
              </span>
            </button>
            {isOpen && (
              <p className="anim-fade-in -mt-1 mb-3 max-w-measure border-l border-divider pl-4 font-display text-[0.95rem] italic leading-relaxed text-muted">
                {e.rationale || "No rationale recorded for this run."}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

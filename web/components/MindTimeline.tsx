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

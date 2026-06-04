"use client";
import { useEffect, useState } from "react";
import type { Latest } from "@/lib/types";
import { type Dir, useCountUp } from "@/lib/hooks";
import { fmtUsd, fmtDateTime, relativeTime } from "@/lib/format";
import { fetchActualPrices } from "@/lib/data";
import { Sparkline } from "@/components/Sparkline";

const FLASH: Record<Dir, string> = { up: "text-up", down: "text-down", flat: "text-ink" };

/** A calm magazine nameplate that stays pinned, so the ticking price is always
 *  visible without dominating. No glow, no hard pulse — editorial gravitas. */
export function Masthead({ latest, livePrice, dir, updatedAt, now }: {
  latest: Latest | null; livePrice: number | null; dir: Dir; updatedAt: number | null; now: number;
}) {
  const price = livePrice ?? latest?.spot ?? null;
  const animated = useCountUp(price);
  const [spark, setSpark] = useState<number[]>([]);
  useEffect(() => {
    let alive = true;
    fetchActualPrices(1).then((p) => alive && setSpark(p.map((x) => x.price)));
    return () => { alive = false; };
  }, []);

  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-keyline bg-base/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-base/65">
      <div className="mx-auto flex max-w-ledger items-center justify-between gap-3 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-body text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
            BTC&nbsp;Event&nbsp;Oracle
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-keyline px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-up/80" aria-hidden /> Live
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block"><Sparkline points={spark} /></div>
          <div className="text-right">
            <div className={`font-mono text-xl font-medium tnum transition-colors duration-300 ${FLASH[dir]}`}>
              {animated ? fmtUsd(animated) : "—"}
            </div>
            <div className="font-mono text-[10px] text-faint">
              as of {fmtDateTime(latest?.run_at ?? null)}
              {updatedAt ? ` · upd ${relativeTime(new Date(updatedAt).toISOString(), now)}` : ""}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

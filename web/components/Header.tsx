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

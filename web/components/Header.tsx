import type { Latest } from "@/lib/types";
import { fmtUsd, fmtDateTime } from "@/lib/format";

export function Header({ latest, livePrice }: { latest: Latest | null; livePrice: number | null }) {
  return (
    <header className="border-b border-zinc-800 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-50">
            <span aria-hidden="true" className="text-[#f7931a]">₿</span> BTC Event Oracle
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            An honest, hourly Bitcoin forecast driven by world events — and held accountable
            against a random-walk benchmark. Not a crystal ball; a tracked method.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Live BTC</div>
          <div className="text-2xl font-bold text-zinc-50">
            {livePrice !== null ? fmtUsd(livePrice) : latest?.spot !== null && latest?.spot !== undefined ? fmtUsd(latest.spot) : "—"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            as of {fmtDateTime(latest?.run_at ?? null)}
          </div>
          <div className="mt-1">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${
                latest?.llm_applied
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-600/40 bg-zinc-700/20 text-zinc-400"
              }`}
            >
              {latest?.llm_applied ? `Claude overlay (${latest.model_id ?? 'unknown'})` : "baseline only"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

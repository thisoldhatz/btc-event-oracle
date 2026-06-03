import type { ResultItem } from "@/lib/types";
import { buildCallRows } from "@/lib/results";
import { HORIZON_LABEL, fmtUsd } from "@/lib/format";

export function RecentCalls({ results }: { results: ResultItem[] }) {
  const rows = buildCallRows(results);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Did it call it?</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">
          No calls have matured yet — the first 1-week forecast resolves about a week after launch. Check back.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-800">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <span className="text-zinc-300">{HORIZON_LABEL[r.horizon]}</span>
                <span className="ml-2 text-zinc-500">
                  said {r.predictedUp ? "up" : "down"}, was {r.actualUp ? "up" : "down"}
                </span>
                <div className="text-xs text-zinc-600">
                  est {fmtUsd(r.central)} · actual {fmtUsd(r.realized)} ({r.pctErr.toFixed(1)}% off)
                  {r.inRange !== null && <> · {r.inRange ? "in range" : "outside range"}</>}
                </div>
              </div>
              <span className={`text-lg font-bold ${r.hit ? "text-emerald-400" : "text-rose-400"}`}>
                {r.hit ? "✓" : "✗"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Market } from "@/lib/types";

export function MarketsPanel({ markets }: { markets: Market[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        What real-money markets imply <span className="text-zinc-600">· Polymarket</span>
      </h3>
      {(!markets || markets.length === 0) ? (
        <p className="mt-3 text-sm text-zinc-600">No live markets right now.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {markets.map((m, i) => {
            const pct = Math.round(m.yes_prob * 100);
            return (
              <li key={i}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{m.question}</span>
                  <span className="shrink-0 font-semibold text-zinc-100">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-[#60a5fa]" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-zinc-600">Live prices from a real-money prediction market — shown for context, not as our forecast.</p>
    </div>
  );
}

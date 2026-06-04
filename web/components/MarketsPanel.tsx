import type { Market } from "@/lib/types";
import { fmtPct, timeUntil } from "@/lib/format";

/** A compact ledger of what real-money prediction markets imply — the crowd's
 *  odds, shown for context, NOT our forecast. Violet (= the market) throughout,
 *  never orange. Each row: the question (font-body) + a mono % with a thin
 *  violet progress rule on a keyline track. Honest empty state. */
export function MarketsPanel({ markets }: { markets: Market[] }) {
  const rows = markets ?? [];
  return (
    <div className="anim-fade-up rounded-lg border border-keyline bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-ink">What the market implies</h3>
        <span className="kicker text-market">Prediction market</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 max-w-measure text-[0.95rem] leading-relaxed text-muted">
          No live markets right now — this fills in when real-money prediction
          markets are quoting Bitcoin questions.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-keyline">
          {rows.map((m, i) => {
            const pct = Math.max(0, Math.min(1, m.yes_prob));
            const ends = m.end_date ? timeUntil(m.end_date) : "";
            return (
              <li key={i} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-body text-[0.9rem] leading-snug text-ink">{m.question}</span>
                  <span className="shrink-0 font-mono text-base text-market tnum">{fmtPct(m.yes_prob)}</span>
                </div>
                <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <div className="h-full rounded-full bg-market/70" style={{ width: `${pct * 100}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-faint tnum">
                  <span>chance “yes”</span>
                  {ends && ends !== "resolved" && <span>resolves in {ends}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 border-t border-keyline pt-3 font-mono text-[11px] text-faint">
        Live odds from a real-money prediction market — shown for context, not our forecast.
      </p>
    </div>
  );
}

import type { ResultItem } from "@/lib/types";
import { buildCallRows, type CallRow } from "@/lib/results";
import { HORIZON_LABEL, fmtUsd, fmtDateTime } from "@/lib/format";

/** "Did it call it?" — resolved verdicts as a box-score. Each row a hairline-ruled
 *  entry: horizon (serif), the said-vs-was call (mono), estimate vs actual with
 *  %-off, in/out of range, and a restrained ✓/✗ paired with text at right — never
 *  colour alone. Up/down stay muted so a green tick never reads as a buy signal. */
function VerdictRow({ r }: { r: CallRow }) {
  const said = r.predictedUp ? "up" : "down";
  const was = r.actualUp ? "up" : "down";
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h4 className="font-display text-base text-ink">{HORIZON_LABEL[r.horizon]}</h4>
          <span className="font-mono text-[11px] text-faint tnum">
            resolved {fmtDateTime(r.target_at)}
          </span>
        </div>
        <div className="mt-1 font-mono text-[13px] text-muted tnum">
          said <span className={r.predictedUp ? "text-up" : "text-down"}>
            <span aria-hidden>{r.predictedUp ? "▲" : "▼"}</span> {said}
          </span>
          {" · "}was <span className={r.actualUp ? "text-up" : "text-down"}>
            <span aria-hidden>{r.actualUp ? "▲" : "▼"}</span> {was}
          </span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-faint tnum">
          est {fmtUsd(r.central)} · actual <span className="text-cool">{fmtUsd(r.realized)}</span>
          {" "}({r.pctErr.toFixed(1)}% off)
          {r.inRange !== null && (
            <> · {r.inRange ? "in range" : "outside range"}</>
          )}
        </div>
      </div>
      <div
        className={`shrink-0 text-right font-mono text-[13px] tnum ${r.hit ? "text-up" : "text-down"}`}
      >
        <span aria-hidden className="text-base">{r.hit ? "✓" : "✗"}</span>
        <div className="text-[11px] uppercase tracking-wide">{r.hit ? "called it" : "missed"}</div>
      </div>
    </li>
  );
}

export function RecentCalls({ results }: { results: ResultItem[] }) {
  const rows = buildCallRows(results);
  const hits = rows.filter((r) => r.hit).length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl text-ink">Did it call it?</h3>
        {rows.length > 0 && (
          <span className="font-mono text-[11px] text-faint tnum">
            {hits}/{rows.length} directional calls correct
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 max-w-measure font-body text-[0.95rem] leading-relaxed text-muted">
          Not enough resolved forecasts yet — the first 1-week call matures about a week after
          launch, and this box-score fills in as calls come due.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-keyline">
          {rows.map((r, i) => (
            <VerdictRow key={`${r.horizon}-${r.target_at}-${i}`} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

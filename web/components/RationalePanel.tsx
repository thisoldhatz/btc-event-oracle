import type { Latest } from "@/lib/types";
import { sortForecasts, fmtDateTime } from "@/lib/format";

/** "Why it moved" as an editorial PULL-QUOTE: a thick orange left keyline and
 *  the rationale set large and quiet, with a small mono dateline. When Claude
 *  applied no event adjustment this run, it reads as a confident statement —
 *  not an empty box: the raw quant baseline simply stands. */
export function RationalePanel({ latest }: { latest: Latest }) {
  const raw = sortForecasts(latest.forecasts)?.[0]?.rationale?.trim();
  const applied = latest.llm_applied && !!raw;
  const body = applied
    ? raw
    : "No event-driven adjustment this run — the raw quant baseline stands.";

  return (
    <figure className="anim-fade-up border-l-2 border-accent pl-4">
      <blockquote className="font-body text-[1.0625rem] leading-relaxed text-ink">
        {body}
      </blockquote>
      <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-wide text-faint tnum">
        Latest run · {fmtDateTime(latest.run_at)}
      </figcaption>
    </figure>
  );
}

// components/SignalsStrip.tsx
import type { Signal } from "@/lib/types";
import { signalDisplay, signalStale } from "@/lib/format";

/** "What the model is watching" — a horizontal band of hairline-divided cells
 *  (no boxes). Each cell: a quiet label, a neutral-ink number (color never
 *  implies a buy signal), a small ▲/▼ delta whose ONLY job is to carry tone via
 *  sign+glyph, and a one-line plain-English read. Honest empty state. */
export function SignalsStrip({ signals }: { signals: Signal[] }) {
  if (!signals || signals.length === 0) {
    return (
      <p className="font-mono text-[12px] text-faint">
        no live signals right now — this strip fills in as the feeds report.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-keyline border-y border-keyline sm:grid-cols-3 md:grid-cols-5 md:divide-y-0 md:border-y-0">
      {signals.map((s) => {
        const d = signalDisplay(s);
        // Delta is a signed string like "+3" / "-2" / null. The sign alone drives
        // the glyph + muted color, so meaning never relies on hue alone, and the
        // value above always stays neutral ink (no green = "buy").
        const down = d.delta != null && d.delta.startsWith("-");
        const flat = d.delta === "+0" || d.delta === "0";
        const up = d.delta != null && !down && !flat;
        const st = signalStale(s.observed_at, s.signal);
        return (
          <div
            key={s.source + s.signal}
            className="px-4 py-4 anim-fade-up"
            title={d.hint}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-body text-[11px] uppercase tracking-wide text-faint">
                {d.label}
                {st?.stale && (
                  <span className="ml-1.5 font-mono text-[10px] text-caution tnum" title={`Last update ~${Math.round(st.ageH)}h ago — older than this signal's normal cadence.`}>
                    stale {Math.round(st.ageH)}h
                  </span>
                )}
              </span>
              {d.delta != null && (
                <span
                  className={`font-mono text-[11px] tnum ${
                    down ? "text-down" : up ? "text-up" : "text-faint"
                  }`}
                >
                  {up && <span aria-hidden>▲ </span>}
                  {down && <span aria-hidden>▼ </span>}
                  {d.delta}
                </span>
              )}
            </div>
            <div className="mt-1.5 font-mono text-xl text-ink tnum">{d.value}</div>
            <div className="mt-1.5 line-clamp-2 font-body text-[11px] leading-snug text-faint">
              {d.hint}
            </div>
          </div>
        );
      })}
    </div>
  );
}

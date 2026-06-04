import type { Forecast } from "@/lib/types";
import { fmtUsd, fmtPct, HORIZON_LABEL, timeUntil } from "@/lib/format";
import { InfoDot } from "@/components/InfoDot";

/** A welded range "thermometer": the central tick lives INSIDE the band, so a
 *  bare point estimate is structurally impossible. */
function Thermometer({ lower, central, upper }: { lower: number; central: number; upper: number }) {
  const span = upper - lower || 1;
  const pct = Math.max(0, Math.min(1, (central - lower) / span)) * 100;
  return (
    <div className="mt-3" aria-hidden>
      <div className="relative h-2 rounded-full bg-accent/12">
        <div className="absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 bg-accent" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Three horizons as hairline-divided editorial columns (no boxes). The RANGE
 *  leads; the central is labeled "central guess" and rendered small and quiet. */
export function HorizonTriptych({ forecasts, now }: { forecasts: Forecast[]; now: number }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-keyline md:grid-cols-3 md:divide-x md:divide-y-0">
      {forecasts.map((f, i) => {
        const up = f.p_up >= 0.5;
        const coin = Math.abs(f.p_up - 0.5) < 0.04;
        const first = i === 0;
        const last = i === forecasts.length - 1;
        return (
          <div key={f.horizon} className={`py-5 md:py-0 ${first ? "md:pr-6" : last ? "md:pl-6" : "md:px-6"}`}>
            <h3 className="font-display text-lg text-ink">{HORIZON_LABEL[f.horizon]}</h3>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-wide text-faint">most-likely range</div>
            <div className="font-mono text-xl text-ink tnum">{fmtUsd(f.lower)} – {fmtUsd(f.upper)}</div>
            <Thermometer lower={f.lower} central={f.central} upper={f.upper} />
            <div className="mt-3 font-mono text-xs text-muted tnum">
              central guess {fmtUsd(f.central)}
              <InfoDot text="The single most-likely point — but the band above is the forecast. A lone number would imply false precision." />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wide text-faint">
                  P(up)
                  <InfoDot text="Estimated chance BTC is higher than today by this date. ~50% is a coin-flip — usually the honest answer for Bitcoin." />
                </div>
                <div className={`font-mono text-lg tnum ${coin ? "text-muted" : up ? "text-up" : "text-down"}`}>
                  <span aria-hidden>{up ? "▲" : "▼"}</span> {fmtPct(f.p_up)}
                  {coin && <span className="ml-1.5 text-[11px] text-faint">coin-flip</span>}
                </div>
              </div>
              <div className="text-right font-mono text-[11px] text-faint tnum">
                resolves in<br />
                <span className="text-muted">{timeUntil(f.target_at, now)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

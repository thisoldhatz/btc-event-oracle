import type { Forecast } from "@/lib/types";
import { fmtUsd, fmtPct, fmtSignedBps, HORIZON_LABEL, confidenceClass, timeUntil } from "@/lib/format";
import { InfoDot } from "@/components/InfoDot";

export function HorizonCard({ f, now }: { f: Forecast; now: number }) {
  const up = f.p_up >= 0.5;
  const left = timeUntil(f.target_at, now);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{HORIZON_LABEL[f.horizon]}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${confidenceClass(f.confidence_label)}`}>
          {f.confidence_label} confidence
        </span>
      </div>

      <div className="mt-3 text-3xl font-bold text-zinc-50">{fmtUsd(f.central)}</div>
      <div className="mt-1 text-sm text-zinc-400">
        range <span className="text-zinc-200">{fmtUsd(f.lower)}</span> – <span className="text-zinc-200">{fmtUsd(f.upper)}</span>
        <InfoDot text="There's roughly a 60% chance the price lands inside this band. Wider = more uncertain; longer horizons always widen." />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
        <div>
          <div className="text-xs text-zinc-500">
            P(up)
            <InfoDot text="Estimated chance BTC is higher than today by this date. ~50% is a coin-flip — the honest answer for Bitcoin most of the time." />
          </div>
          <div className={`text-lg font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>{fmtPct(f.p_up)}</div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>
            drift {fmtSignedBps(f.drift_adj_bps)}
            <InfoDot text="Claude's small, hard-capped news-driven nudges: drift tilts the central estimate up/down; vol widens or tightens the range." />
          </div>
          <div>vol ×{f.vol_mult.toFixed(2)}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        resolves in <span className="text-zinc-300">{left}</span>
      </div>
    </div>
  );
}

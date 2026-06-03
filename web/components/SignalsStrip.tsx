// components/SignalsStrip.tsx
import type { Signal } from "@/lib/types";
import { signalDisplay, type SignalTone } from "@/lib/format";

const TONE: Record<SignalTone, string> = {
  fear: "text-rose-300",
  down: "text-rose-300",
  greed: "text-emerald-300",
  up: "text-emerald-300",
  neutral: "text-zinc-100",
};

export function SignalsStrip({ signals }: { signals: Signal[] }) {
  if (!signals || signals.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {signals.map((s) => {
          const d = signalDisplay(s);
          return (
            <div key={s.source + s.signal} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                 title={d.hint}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{d.label}</span>
                {d.delta && (
                  <span className={`text-xs ${d.delta.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>
                    {d.delta}
                  </span>
                )}
              </div>
              <div className={`mt-1 text-xl font-bold ${TONE[d.tone]}`}>{d.value}</div>
              <div className="mt-1 truncate text-xs text-zinc-600">{d.hint}</div>
            </div>
          );
        })}
    </div>
  );
}

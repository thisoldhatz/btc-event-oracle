import type { Latest } from "@/lib/types";
import { sortForecasts } from "@/lib/format";

export function RationalePanel({ latest }: { latest: Latest | null }) {
  const rationale = latest ? sortForecasts(latest.forecasts)?.[0]?.rationale : undefined;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Why it moved
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
        {rationale || "No event-driven adjustment this run — showing the raw quant baseline."}
      </p>
    </div>
  );
}

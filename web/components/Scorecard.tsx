// components/Scorecard.tsx
import type { Scores } from "@/lib/types";
import { buildScoreRows } from "@/lib/scores";

export function Scorecard({ scores }: { scores: Scores }) {
  const rows = buildScoreRows(scores);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Accuracy scorecard <span className="text-zinc-600">· vs. random walk</span>
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr className="text-left">
              <th className="py-2 pr-3 font-medium">Horizon</th>
              <th className="py-2 pr-3 font-medium">N</th>
              <th className="py-2 pr-3 font-medium">Brier</th>
              <th className="py-2 pr-3 font-medium">vs base</th>
              <th className="py-2 pr-3 font-medium">MAPE</th>
              <th className="py-2 pr-3 font-medium">Cover</th>
              <th className="py-2 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.horizon} className="border-t border-zinc-800 text-zinc-200">
                <td className="py-2 pr-3">{r.label}</td>
                {r.hasData ? (
                  <>
                    <td className="py-2 pr-3">{r.n}</td>
                    <td className="py-2 pr-3">{r.brier}</td>
                    <td className="py-2 pr-3">{r.brierBase}</td>
                    <td className="py-2 pr-3">{r.mape}</td>
                    <td className="py-2 pr-3">{r.coverage}</td>
                    <td className="py-2 text-zinc-300">{r.verdict}</td>
                  </>
                ) : (
                  <td className="py-2 text-zinc-500" colSpan={6}>
                    {r.verdict}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        At 1-week/1-month horizons, tying random walk (BSS ≈ 0) is the honest, expected result.
      </p>
    </div>
  );
}

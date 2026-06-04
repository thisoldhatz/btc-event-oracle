// components/SkillPanel.tsx
import type { Scores } from "@/lib/types";
import { buildSkillRows } from "@/lib/skill";

export function SkillPanel({ scores }: { scores: Scores }) {
  const rows = buildSkillRows(scores);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Calibration &amp; skill <span className="text-zinc-600">· proper scoring</span>
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr className="text-left">
              <th className="py-2 pr-3 font-medium">Horizon</th>
              <th className="py-2 pr-3 font-medium" title="Continuous Ranked Probability skill vs random walk; >0 = better">CRPS skill</th>
              <th className="py-2 pr-3 font-medium" title="Brier skill score vs random walk">Brier skill</th>
              <th className="py-2 pr-3 font-medium">Coverage</th>
              <th className="py-2 font-medium">Claude vs baseline</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.horizon} className="border-t border-zinc-800 text-zinc-200">
                <td className="py-2 pr-3">{r.label} {r.hasData && <span className="text-zinc-600">(N={r.n})</span>}</td>
                {r.hasData ? (
                  <>
                    <td className="py-2 pr-3">{r.crpss}</td>
                    <td className="py-2 pr-3">{r.bss}</td>
                    <td className="py-2 pr-3">{r.coverage}</td>
                    <td className="py-2 text-zinc-300">{r.abVerdict}</td>
                  </>
                ) : (
                  <td className="py-2 text-zinc-500" colSpan={4}>Not enough resolved forecasts yet</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        Skill scores near 0 mean ≈ a random walk — the honest expectation at short horizons. These fill in as forecasts mature.
      </p>
    </div>
  );
}

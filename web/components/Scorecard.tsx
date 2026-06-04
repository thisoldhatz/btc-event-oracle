// components/Scorecard.tsx
import type { Scores, ScoreH, Horizon } from "@/lib/types";
import { HORIZON_ORDER, HORIZON_LABEL, fmtPct } from "@/lib/format";

/** A tiny zero-axis micro-bar reading "vs random walk" skill. The bar grows
 *  RIGHT from the centre in muted green when the model beats the naive
 *  benchmark, LEFT in muted red when it's worse, and stays a near-centred stub
 *  on a tie. Skill is the mean of the directional (BSS) and full-distribution
 *  (CRPSS) skill scores when both are present. A sign glyph (+/−/≈) carries the
 *  meaning so it never relies on colour alone. */
function SkillBar({ skill }: { skill: number | null }) {
  if (skill === null) {
    return <span className="font-mono text-xs text-faint tnum">—</span>;
  }
  // Tie window: short-horizon BTC is near-random-walk, so |skill| < ~0.02 is "even".
  const tie = Math.abs(skill) < 0.02;
  const better = skill > 0;
  // Map skill onto a half-width fraction; clamp so extremes don't overflow.
  const mag = Math.min(1, Math.abs(skill) / 0.25);
  const halfPct = tie ? 6 : Math.max(8, mag * 50);
  const tone = tie ? "text-muted" : better ? "text-up" : "text-down";
  const fill = tie ? "bg-muted/40" : better ? "bg-up/70" : "bg-down/70";
  const glyph = tie ? "≈" : better ? "+" : "−";
  const word = tie ? "even" : better ? "beats" : "trails";
  return (
    <div
      className="flex items-center gap-2"
      title={`${word} random walk · skill ${skill >= 0 ? "+" : ""}${skill.toFixed(2)} (mean of BSS / CRPSS)`}
    >
      <div className="relative h-2.5 w-16 rounded-sm bg-sunken" aria-hidden>
        {/* zero axis */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-keyline" />
        <div
          className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-sm ${fill}`}
          style={
            better
              ? { left: "50%", width: `${halfPct / 2}%` }
              : { right: "50%", width: `${halfPct / 2}%` }
          }
        />
      </div>
      <span className={`font-mono text-[11px] tnum ${tone}`}>
        <span aria-hidden>{glyph}</span>
        {Math.abs(skill).toFixed(2)}
      </span>
    </div>
  );
}

interface Metric {
  label: string;
  value: string;
  hint: string;
  tnum?: boolean;
}

function metricsFor(s: ScoreH): Metric[] {
  const cov =
    s.coverage === null || s.coverage === undefined ? null : s.coverage;
  const covNom =
    s.coverage_nominal === null || s.coverage_nominal === undefined
      ? null
      : s.coverage_nominal;
  const coverageStr =
    cov === null
      ? "—"
      : covNom === null
        ? fmtPct(cov)
        : `${fmtPct(cov)} / ${fmtPct(covNom)}`;
  return [
    {
      label: "N",
      value: String(s.n),
      hint: "Resolved forecasts graded so far at this horizon.",
      tnum: true,
    },
    {
      label: "Brier",
      value: s.brier === null || s.brier === undefined ? "—" : s.brier.toFixed(3),
      hint: "Mean squared error of P(up) vs the up/down outcome. Lower is better; 0.25 is a coin-flip.",
      tnum: true,
    },
    {
      label: "MAPE",
      value:
        s.mape === null || s.mape === undefined ? "—" : s.mape.toFixed(1) + "%",
      hint: "Mean absolute % error of the central price guess. Lower is better.",
      tnum: true,
    },
    {
      label: "Coverage",
      value: coverageStr,
      hint: "How often the real price landed inside the range (actual) vs how often it was meant to (nominal). Close together = well-calibrated bands.",
      tnum: true,
    },
  ];
}

/** Mean of available skill scores (directional BSS + distributional CRPSS),
 *  so the "vs random walk" bar reflects both the P(up) call and the full band. */
function skillFor(s: ScoreH): number | null {
  const parts = [s.bss, s.crpss].filter(
    (x): x is number => x !== null && x !== undefined,
  );
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** The accuracy record as a calm editorial ledger. Each horizon is a row of
 *  hairline-ruled cells; a near-zero "vs random walk" bar is the honest,
 *  expected result at short horizons, not a failure. Empty horizons state
 *  plainly that they fill in as calls mature. */
export function Scorecard({ scores }: { scores: Scores }) {
  const rows: { horizon: Horizon; label: string; s: ScoreH }[] =
    HORIZON_ORDER.map((h) => ({
      horizon: h,
      label: HORIZON_LABEL[h],
      s: scores?.[h] ?? { n: 0 },
    }));

  return (
    <div className="anim-fade-up rounded-xl border border-keyline bg-sunken p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-ink">The accuracy record</h3>
        <span className="font-mono text-[11px] uppercase tracking-wide text-faint">
          vs random walk
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left">
              <th className="py-2 pr-4 font-mono text-[11px] font-normal uppercase tracking-wide text-faint">
                Horizon
              </th>
              <th className="py-2 pr-4 text-right font-mono text-[11px] font-normal uppercase tracking-wide text-faint">
                N
              </th>
              <th className="py-2 pr-4 text-right font-mono text-[11px] font-normal uppercase tracking-wide text-faint">
                Brier
              </th>
              <th className="py-2 pr-4 text-right font-mono text-[11px] font-normal uppercase tracking-wide text-faint">
                MAPE
              </th>
              <th
                className="py-2 pr-4 text-right font-mono text-[11px] font-normal uppercase tracking-wide text-faint"
                title="Actual coverage / nominal coverage — how often the price landed in the range vs how often it should have."
              >
                Coverage
              </th>
              <th className="py-2 font-mono text-[11px] font-normal uppercase tracking-wide text-faint">
                vs random walk
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-keyline">
            {rows.map(({ horizon, label, s }) => {
              if (!s.n) {
                return (
                  <tr key={horizon}>
                    <td className="py-3 pr-4 align-top">
                      <span className="font-display text-base text-ink">
                        {label}
                      </span>
                    </td>
                    <td className="py-3 text-muted" colSpan={5}>
                      <span className="font-body text-xs italic text-faint">
                        insufficient data — fills in as calls mature
                      </span>
                    </td>
                  </tr>
                );
              }
              const metrics = metricsFor(s);
              return (
                <tr key={horizon} className="align-middle">
                  <td className="py-3 pr-4">
                    <span className="font-display text-base text-ink">
                      {label}
                    </span>
                  </td>
                  {metrics.map((m) => (
                    <td
                      key={m.label}
                      className="py-3 pr-4 text-right"
                      title={m.hint}
                    >
                      <span
                        className={`font-mono text-sm text-ink ${m.tnum ? "tnum" : ""}`}
                      >
                        {m.value}
                      </span>
                    </td>
                  ))}
                  <td className="py-3">
                    <SkillBar skill={skillFor(s)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-measure font-body text-xs leading-relaxed text-faint">
        Tying the random walk is the honest expected result at short horizons.
      </p>
    </div>
  );
}

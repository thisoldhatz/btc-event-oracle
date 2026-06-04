import type { Market, MarketHeadToHead } from "@/lib/types";
import { fmtPct } from "@/lib/format";
import { Standfirst } from "@/components/Section";

/** The credibility payoff: once markets resolve, an honest scoreboard of the
 *  model's Brier vs the market's Brier (lower is better) and who's been closer. */
function ScoredSummary({ s }: { s: MarketHeadToHead }) {
  const modelB = s.model_brier ?? 0;
  const marketB = s.market_brier ?? 0;
  const lead =
    modelB < marketB ? "The model" : marketB < modelB ? "The market" : "Neither side";
  return (
    <div className="mt-5 rounded-md border border-keyline bg-sunken p-4">
      <div className="font-mono text-[11px] uppercase tracking-wide text-faint">
        who&apos;s been closer · {s.n} resolved
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 font-mono text-sm tnum sm:grid-cols-2">
        <div className="text-ink">
          <span className="text-accent">model</span> Brier {modelB.toFixed(3)} · closer {s.model_closer ?? 0}/{s.n}
        </div>
        <div className="text-ink">
          <span className="text-market">market</span> Brier {marketB.toFixed(3)} · closer {s.market_closer ?? 0}/{s.n}
        </div>
      </div>
      <p className="mt-2 max-w-measure font-body text-xs leading-relaxed text-faint">
        Lower Brier is better.{" "}
        {lead === "Neither side"
          ? "Dead even so far."
          : `${lead} has been closer to the truth so far — and that's the honest scoreboard, whichever way it falls.`}
      </p>
    </div>
  );
}

/** "The model vs the crowd." A dumbbell per market: the model's P(up) (orange)
 *  and the market-implied yes_prob (violet) sit on a shared 0–100% axis, joined
 *  by a connector whose LENGTH is the disagreement. Colour is always paired with
 *  a glyph/label so meaning never relies on hue. Head-to-head scoring isn't live
 *  yet — that's stated plainly, not implied. Pure SVG, no chart dep. */
export function HeadToHead({ markets, modelPup, scored }: {
  markets: Market[]; modelPup: number | null; scored?: MarketHeadToHead;
}) {
  const rows = markets ?? [];
  const hasScored = !!scored && scored.n > 0;

  if (rows.length === 0) {
    return (
      <div>
        <Standfirst>Real money has an opinion too — here&apos;s where we agree and disagree.</Standfirst>
        {hasScored && <ScoredSummary s={scored!} />}
        <p className="mt-6 rounded-md border border-keyline bg-sunken px-4 py-5 font-mono text-[13px] leading-relaxed text-faint">
          no live markets to compare against right now — this fills in when a real-money market is open.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Standfirst>Real money has an opinion too — here&apos;s where we agree and disagree.</Standfirst>
      {hasScored && <ScoredSummary s={scored!} />}

      {/* legend — colour bound to a label, never standalone */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          the model&apos;s P(up)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-market" aria-hidden />
          the market&apos;s yes
        </span>
      </div>

      <ul className="mt-5 divide-y divide-keyline">
        {rows.map((m, i) => (
          <Dumbbell key={i} question={m.question} modelPup={modelPup} marketProb={m.yes_prob} />
        ))}
      </ul>

      {!hasScored && (
        <p className="mt-5 font-mono text-[11px] text-faint">
          scored once these markets resolve — for now it&apos;s a snapshot of where two opinions sit, not a track record.
        </p>
      )}
    </div>
  );
}

/** One question + its dumbbell row. */
function Dumbbell({ question, modelPup, marketProb }: {
  question: string; modelPup: number | null; marketProb: number;
}) {
  const W = 760, H = 64, padX = 44;
  const x = (p: number) => padX + Math.max(0, Math.min(1, p)) * (W - 2 * padX);
  const axisY = 30;

  const mkX = x(marketProb);
  const haveModel = modelPup != null;
  const mdX = haveModel ? x(modelPup as number) : null;

  const gap = haveModel ? Math.abs((modelPup as number) - marketProb) : null;
  // honest characterisation of the disagreement
  const gapLabel =
    gap == null ? null : gap < 0.05 ? "they roughly agree" : gap < 0.15 ? "mild disagreement" : "they part ways";

  return (
    <li className="py-5 anim-fade-up">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-base leading-snug text-ink">{question}</h3>
        {gapLabel && (
          <span className="shrink-0 font-mono text-[11px] text-faint">{gapLabel}</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        role="img"
        aria-label={
          haveModel
            ? `The model puts this at ${fmtPct(modelPup as number)} versus the market at ${fmtPct(marketProb)}.`
            : `The market puts this at ${fmtPct(marketProb)}; the model has no comparable estimate yet.`
        }
      >
        {/* axis well 0–100% */}
        <line x1={padX} x2={W - padX} y1={axisY} y2={axisY} stroke="#26262E" strokeWidth="1" />
        {/* 50% coin-flip reference */}
        <line x1={x(0.5)} x2={x(0.5)} y1={axisY - 13} y2={axisY + 13} stroke="#5B5B66" strokeWidth="1" strokeDasharray="3 3" />
        <text x={x(0.5)} y={H - 4} fill="#6B6B76" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">50%</text>
        <text x={padX} y={H - 4} fill="#6B6B76" fontSize="9" fontFamily="var(--font-mono)" textAnchor="start">0%</text>
        <text x={W - padX} y={H - 4} fill="#6B6B76" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end">100%</text>

        {/* connector — its length is the disagreement */}
        {haveModel && mdX != null && (
          <line x1={mdX} x2={mkX} y1={axisY} y2={axisY} stroke="#A8A8B3" strokeWidth="1.5" />
        )}

        {/* market dot (violet) */}
        <circle cx={mkX} cy={axisY} r="6" fill="#8B7CD8" />
        <text
          x={mkX}
          y={axisY - 11}
          fill="#8B7CD8"
          fontSize="12"
          fontFamily="var(--font-mono)"
          textAnchor={mkX > W / 2 ? "end" : "start"}
        >
          {fmtPct(marketProb)}
        </text>

        {/* model dot (orange) */}
        {haveModel && mdX != null && (
          <>
            <circle cx={mdX} cy={axisY} r="6" fill="#F7931A" />
            <text
              x={mdX}
              y={axisY + 21}
              fill="#F7931A"
              fontSize="12"
              fontFamily="var(--font-mono)"
              textAnchor={mdX > W / 2 ? "end" : "start"}
            >
              {fmtPct(modelPup as number)}
            </text>
          </>
        )}
      </svg>

      {!haveModel && (
        <p className="mt-1 font-mono text-[11px] text-faint">
          the model has no comparable P(up) to line up here yet.
        </p>
      )}
    </li>
  );
}

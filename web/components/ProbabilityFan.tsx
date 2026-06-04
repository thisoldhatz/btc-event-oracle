import { fmtUsd } from "@/lib/format";

/** THE SIGNATURE OBJECT. A horizontal probability band drawn LARGER than any
 *  number, with the central estimate as a thin tick INSIDE it — so the eye
 *  reads spread-of-outcomes first, never a lone confident price. Orange = our
 *  forecast; slate dashed = today's spot. Pure SVG (no chart dep). */
export function ProbabilityFan({ lower, central, upper, spot }: {
  lower: number; central: number; upper: number; spot: number | null;
}) {
  const W = 760, H = 132, padX = 10;
  const span = upper - lower || 1;
  const lo = lower - span * 0.1, hi = upper + span * 0.1;
  const x = (v: number) => padX + ((v - lo) / (hi - lo)) * (W - 2 * padX);
  const cx = x(central);
  const sx = spot != null ? x(spot) : null;
  const bandY = 36, bandH = 52;
  return (
    <figure className="anim-fade-up anim-delay-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`One-week forecast band from ${fmtUsd(lower)} to ${fmtUsd(upper)}, central estimate ${fmtUsd(central)}`}>
        <defs>
          <linearGradient id="fanGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#F7931A" stopOpacity="0.04" />
            <stop offset="50%" stopColor="#F7931A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F7931A" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <rect x={x(lower)} y={bandY} width={x(upper) - x(lower)} height={bandH} fill="url(#fanGrad)" rx="3" />
        <line x1={cx} x2={cx} y1={bandY - 7} y2={bandY + bandH + 7} stroke="#F7931A" strokeWidth="2" />
        {sx != null && (
          <line x1={sx} x2={sx} y1={bandY - 3} y2={bandY + bandH + 3} stroke="#7CA9D8" strokeWidth="1.5" strokeDasharray="3 3" />
        )}
        <text x={x(lower)} y={bandY + bandH + 22} fill="#6B6B76" fontSize="11" fontFamily="var(--font-mono)" textAnchor="start">{fmtUsd(lower)}</text>
        <text x={cx} y={bandY - 13} fill="#F4F4F2" fontSize="13" fontFamily="var(--font-mono)" textAnchor="middle">{fmtUsd(central)}</text>
        <text x={x(upper)} y={bandY + bandH + 22} fill="#6B6B76" fontSize="11" fontFamily="var(--font-mono)" textAnchor="end">{fmtUsd(upper)}</text>
        {sx != null && (
          <text x={sx} y={bandY + bandH + 22} fill="#7CA9D8" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle">now</text>
        )}
      </svg>
      <figcaption className="mt-1 font-mono text-[11px] text-faint">
        the band is the forecast — the tick is just its most-likely point
      </figcaption>
    </figure>
  );
}

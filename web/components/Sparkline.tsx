// components/Sparkline.tsx

/** A tiny inline price sparkline. Deliberately neutral: a single slate-blue
 *  (#7CA9D8 = reality/actual) 1px stroke over a faint baseline — NOT a
 *  red/green up/down signal, so a glance never reads as a buy/sell cue. Pure
 *  SVG, no fill, fixed ~64x18 footprint. Renders nothing when there's too
 *  little data to draw an honest line. */
export function Sparkline({ points, width = 64, height = 18 }: {
  points: number[]; width?: number; height?: number;
}) {
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const pad = 1.5; // keep the 1px stroke from clipping at the extremes
  const y = (p: number) =>
    (pad + (1 - (p - min) / range) * (height - 2 * pad)).toFixed(1);
  const pts = points
    .map((p, i) => `${(i * step).toFixed(1)},${y(p)}`)
    .join(" ");
  const baseY = (height - pad).toFixed(1);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label="Recent price movement"
    >
      <line
        x1="0"
        x2={width}
        y1={baseY}
        y2={baseY}
        stroke="#26262E"
        strokeWidth={1}
      />
      <polyline
        points={pts}
        fill="none"
        stroke="#7CA9D8"
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

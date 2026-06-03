// components/Sparkline.tsx
export function Sparkline({ points, width = 84, height = 26 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const step = width / (points.length - 1);
  const pts = points.map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / range) * height).toFixed(1)}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? "#34d399" : "#fb7185"} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

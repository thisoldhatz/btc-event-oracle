// components/FearGreedDial.tsx
export function FearGreedDial({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const label = v < 25 ? "Extreme Fear" : v < 45 ? "Fear" : v < 55 ? "Neutral" : v < 75 ? "Greed" : "Extreme Greed";
  const color = v < 25 ? "#fb7185" : v < 45 ? "#fbbf24" : v < 55 ? "#a3a3a3" : v < 75 ? "#a3e635" : "#34d399";
  const cx = 70, cy = 64, r = 54;
  const ang = Math.PI * (1 - v / 100);                       // 180deg (left) -> 0deg (right)
  const arc = (frac: number) => {
    const a = Math.PI * (1 - frac);
    return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
  };
  const nx = cx + (r - 8) * Math.cos(ang), ny = cy - (r - 8) * Math.sin(ang);
  return (
    <div className="flex flex-col items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="self-start text-xs text-zinc-500">Fear &amp; Greed</div>
      <svg width="140" height="78" viewBox="0 0 140 78">
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}`} fill="none" stroke="#27272a" strokeWidth="8" strokeLinecap="round" />
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(v / 100)}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" />
        <circle cx={cx} cy={cy} r="3" fill={color} />
      </svg>
      <div className="-mt-2 text-xl font-bold" style={{ color }}>{Math.round(v)}</div>
      <div className="text-xs" style={{ color }}>{label}</div>
    </div>
  );
}

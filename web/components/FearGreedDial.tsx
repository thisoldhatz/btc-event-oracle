// components/FearGreedDial.tsx

/** Zone metadata for the crypto Fear & Greed index (0–100). Colors are the
 *  desaturated semantic palette — fear leans muted-red, greed muted-green,
 *  neutral stays grey — never a saturated "buy/sell" hue. Each zone carries a
 *  sign glyph so meaning never relies on color alone. */
type Zone = { label: string; fill: string; glyph: string };
function zoneFor(v: number): Zone {
  if (v < 25) return { label: "Extreme Fear", fill: "#D9636B", glyph: "–" };
  if (v < 45) return { label: "Fear", fill: "#C8893F", glyph: "–" };
  if (v < 55) return { label: "Neutral", fill: "#6B6B76", glyph: "=" };
  if (v < 75) return { label: "Greed", fill: "#5FB58A", glyph: "+" };
  return { label: "Extreme Greed", fill: "#5FB58A", glyph: "+" };
}

/** Hand-rolled, dependency-free semicircle gauge. Restyled to the Ledger
 *  tokens: the track is a hairline-grey arc, the filled portion a desaturated
 *  zone color, a thin needle marks the reading. The number leads in mono; the
 *  zone label sits beneath in a quiet serif. This is a crowd-sentiment signal,
 *  not a claim the model is scored on — so it stays muted, never orange. */
export function FearGreedDial({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const zone = zoneFor(v);
  const cx = 70, cy = 64, r = 54;
  const ang = Math.PI * (1 - v / 100); // 180° (left) -> 0° (right)
  const arc = (frac: number) => {
    const a = Math.PI * (1 - frac);
    return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
  };
  const nx = cx + (r - 8) * Math.cos(ang), ny = cy - (r - 8) * Math.sin(ang);

  return (
    <figure className="anim-fade-in flex flex-col items-center rounded-lg border border-keyline bg-surface p-3">
      <div className="self-start font-mono text-[11px] uppercase tracking-wide text-faint">
        Fear &amp; Greed
      </div>
      <svg
        width="140"
        height="78"
        viewBox="0 0 140 78"
        role="img"
        aria-label={`Crowd Fear & Greed index: ${Math.round(v)} of 100 — ${zone.label}`}
      >
        {/* unlit track */}
        <path
          d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}`}
          fill="none"
          stroke="#26262E"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* lit portion up to the reading */}
        <path
          d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(v / 100)}`}
          fill="none"
          stroke={zone.fill}
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* thin needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#F4F4F2" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2.5" fill="#F4F4F2" />
      </svg>
      <div className="-mt-2 font-mono text-xl font-medium text-ink tnum">
        <span aria-hidden style={{ color: zone.fill }}>{zone.glyph}</span> {Math.round(v)}
      </div>
      <figcaption className="font-display text-sm" style={{ color: zone.fill }}>
        {zone.label}
      </figcaption>
    </figure>
  );
}

// components/SkillPanel.tsx
import type { Scores, Horizon, ScoreH } from "@/lib/types";
import { HORIZON_ORDER, HORIZON_LABEL } from "@/lib/format";
import { InfoDot } from "@/components/InfoDot";

/** A skill score (CRPSS / BSS) drawn as a micro-bar centered on a zero axis:
 *  >0 leans right (text-up, "beats a coin / random walk"), <0 leans left
 *  (text-down), ~0 sits dead-centered — so "near zero = honest, balanced" reads
 *  as intentional, not a failure. The value never relies on hue alone (a +/-
 *  sign rides every number; ≈0 is annotated "≈ even"). Pure SVG, no chart dep. */
function SkillBar({ value, label }: { value: number | null | undefined; label: string }) {
  const W = 132, H = 18, mid = W / 2, padY = 4;
  // Clamp the visual reach; skill scores past ±1 are pinned to the rail edge.
  const CAP = 1;
  const v = value == null ? 0 : Math.max(-CAP, Math.min(CAP, value));
  const reach = (Math.abs(v) / CAP) * (mid - 2);
  const near = value != null && Math.abs(value) < 0.02;
  const has = value != null;
  const pos = has && value > 0;
  const fill = !has || near ? "#6B6B76" : pos ? "#5FB58A" : "#D9636B";
  const x = pos ? mid : mid - reach;
  const txt =
    value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
  return (
    <div className="flex items-center gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[18px] w-[132px] shrink-0"
        role="img"
        aria-label={`${label}: ${txt}${near ? " (about even)" : ""}`}
      >
        {/* zero axis */}
        <line x1={mid} x2={mid} y1={padY - 2} y2={H - padY + 2} stroke="#5B5B66" strokeWidth="1" strokeDasharray="2 2" />
        {/* the skill bar, growing out from center */}
        {has && !near && (
          <rect x={x} y={padY} width={reach} height={H - 2 * padY} fill={fill} fillOpacity="0.85" rx="1.5" />
        )}
        {/* near-zero / no-data: a quiet centered pip so the row never looks empty */}
        {(!has || near) && (
          <rect x={mid - 1.5} y={padY} width="3" height={H - 2 * padY} fill="#6B6B76" fillOpacity="0.7" rx="1.5" />
        )}
      </svg>
      <span
        className={`w-11 shrink-0 text-right font-mono text-xs tnum ${
          !has || near ? "text-faint" : pos ? "text-up" : "text-down"
        }`}
      >
        {txt}
      </span>
    </div>
  );
}

/** Coverage as actual / nominal, with a small target tick at the nominal mark —
 *  so "is the band the right width?" is answered visually, not just numerically. */
function CoverageMeter({ s }: { s: ScoreH }) {
  const cov = s.coverage;
  const nom = s.coverage_nominal;
  if (cov == null) return <span className="font-mono text-xs text-faint">—</span>;
  const actualTxt = `${Math.round(cov * 100)}%`;
  const nomTxt = nom != null ? `${Math.round(nom * 100)}%` : "—";
  // Fill toward the nominal target; the tick marks where we'd ideally land.
  const W = 96, H = 16, padX = 1, padY = 3;
  const inner = W - 2 * padX;
  const fillW = Math.max(0, Math.min(1, cov)) * inner;
  const tickX = nom != null ? padX + Math.max(0, Math.min(1, nom)) * inner : null;
  // Honest tone: within a few points of nominal is good; far off leans caution.
  const off = nom != null ? Math.abs(cov - nom) : 0;
  const good = nom != null && off <= 0.05;
  const fill = good ? "#5FB58A" : "#D2A24C";
  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-4 w-24 shrink-0" role="img" aria-label={`Coverage ${actualTxt} of nominal ${nomTxt}`}>
        <rect x={padX} y={padY} width={inner} height={H - 2 * padY} fill="#0F0F13" stroke="#26262E" strokeWidth="1" rx="2" />
        <rect x={padX} y={padY} width={fillW} height={H - 2 * padY} fill={fill} fillOpacity="0.6" rx="2" />
        {tickX != null && (
          <line x1={tickX} x2={tickX} y1={1} y2={H - 1} stroke="#5B5B66" strokeWidth="1.5" />
        )}
      </svg>
      <span className="font-mono text-xs tnum text-ink">
        {actualTxt}
        <span className="text-faint"> / {nomTxt}</span>
      </span>
    </div>
  );
}

interface VerdictView {
  glyph: string;
  text: string;
  cls: string;
}

/** PRIMARY overlay-vs-baseline read using CRPS (the proper, full-distribution
 *  score). Lower CRPS = sharper+better. We derive a relative skill so the
 *  threshold scales with the baseline's difficulty. */
function crpsVerdict(s: ScoreH): VerdictView | null {
  const ab = s.ab;
  if (!ab || ab.model_crps == null || ab.baseline_crps == null) return null;
  const m = ab.model_crps, b = ab.baseline_crps;
  if (!(b > 0)) return null;
  const rel = (b - m) / b; // >0 => overlay sharper than baseline random walk
  if (rel > 0.02) return { glyph: "▲", text: "overlay beats random walk", cls: "text-up" };
  if (rel < -0.02) return { glyph: "▼", text: "random walk beats overlay", cls: "text-down" };
  return { glyph: "≈", text: "overlay ties random walk", cls: "text-muted" };
}

/** The Brier A/B is structurally dead: its baseline is P(up)≡0.50, so this is
 *  literally "did the model's direction beat a coin-flip?" — relabeled as such
 *  to avoid implying it's a second independent contest. Secondary, quiet. */
function coinVerdict(s: ScoreH): VerdictView | null {
  const ab = s.ab;
  if (!ab || ab.model_brier == null || ab.baseline_brier == null) return null;
  const d = ab.baseline_brier - ab.model_brier; // >0 => beats coin-flip
  if (d > 0.005) return { glyph: "✓", text: "beats coin-flip", cls: "text-up" };
  if (d < -0.005) return { glyph: "✗", text: "worse than coin-flip", cls: "text-down" };
  return { glyph: "≈", text: "≈ coin-flip", cls: "text-muted" };
}

function Header({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wide text-faint">
      {label}
      <InfoDot text={hint} />
    </div>
  );
}

export function SkillPanel({ scores }: { scores: Scores }) {
  const rows = HORIZON_ORDER.map((h: Horizon) => {
    const s: ScoreH = scores?.[h] ?? { n: 0 };
    return { horizon: h, label: HORIZON_LABEL[h], s, hasData: !!s.n };
  });
  const anyData = rows.some((r) => r.hasData);

  return (
    <div className="rounded-lg border border-keyline bg-surface p-5 anim-fade-up">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl text-ink">Calibration &amp; skill</h3>
        <span className="font-mono text-[10px] uppercase tracking-wide text-faint">proper scoring · vs random walk</span>
      </div>
      <p className="mt-2 max-w-measure text-[0.9rem] leading-relaxed text-muted">
        Each call is graded against a no-information benchmark — a random walk that just says
        &ldquo;tomorrow looks like today.&rdquo; <span className="text-ink">Skill near zero is the honest, expected
        result for short-horizon Bitcoin</span>, so a centered bar is a feature, not a failure.
      </p>

      {!anyData ? (
        <div className="mt-5 rounded border border-dashed border-keyline bg-sunken px-4 py-6 text-center">
          <div className="font-display text-base italic text-muted">
            Not enough resolved forecasts yet.
          </div>
          <div className="mt-1 font-mono text-xs text-faint">
            This fills in as calls mature — the 1-year row stays empty for about a year, by design.
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-1">
          {/* column legend */}
          <div className="hidden grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-x-4 border-b border-keyline pb-2 md:grid">
            <span className="font-mono text-[10px] uppercase tracking-wide text-faint">Horizon</span>
            <Header label="CRPS skill" hint="Continuous Ranked Probability Skill Score. Grades the WHOLE forecast distribution (range + shape), not just direction, against the random-walk benchmark. >0 = sharper than chance; ~0 = tied." />
            <Header label="Brier skill · vs coin-flip" hint="Brier Skill Score on the up/down call. Its benchmark is a flat 50/50 coin, so this is purely 'did the direction beat a coin-flip?' — not a second independent contest." />
            <Header label="Coverage (actual / nominal)" hint="How often reality landed inside the stated band, vs how often it should have. The tick marks the target; bars far from it mean the band is too narrow or too wide." />
          </div>

          {rows.map((r) => {
            return (
              <div
                key={r.horizon}
                className="grid grid-cols-1 gap-x-4 gap-y-3 rounded border-b border-keyline bg-sunken/40 px-3 py-3 md:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:bg-transparent md:px-0"
              >
                {/* horizon */}
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-base text-ink">{r.label}</span>
                  {r.hasData && (
                    <span className="font-mono text-[10px] text-faint tnum">N={r.s.n}</span>
                  )}
                </div>

                {r.hasData ? (
                  <>
                    {/* CRPS skill bar */}
                    <div>
                      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wide text-faint md:hidden">CRPS skill</div>
                      <SkillBar value={r.s.crpss} label="CRPS skill" />
                    </div>
                    {/* Brier skill bar (vs coin-flip) */}
                    <div>
                      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wide text-faint md:hidden">Brier skill · vs coin-flip</div>
                      <SkillBar value={r.s.bss} label="Brier skill vs coin-flip" />
                    </div>
                    {/* coverage */}
                    <div>
                      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wide text-faint md:hidden">Coverage</div>
                      <CoverageMeter s={r.s} />
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-xs text-faint md:col-span-3">
                    not enough resolved forecasts yet — fills in as calls mature
                  </div>
                )}
              </div>
            );
          })}

          {/* The verdict — CRPS is the primary signal, Brier is the quiet "coin-flip" footnote. */}
          <div className="mt-4 space-y-2 border-t border-keyline pt-4">
            <div className="font-mono text-[10px] uppercase tracking-wide text-faint">
              Overlay vs baseline
              <InfoDot text="The headline read is CRPS: does Claude's bounded overlay improve the FULL forecast (range + direction) over the random-walk baseline? The coin-flip note is a secondary directional-only check." />
            </div>
            {rows.map((r) => {
              if (!r.hasData) return null;
              const verdict = crpsVerdict(r.s);
              const coin = coinVerdict(r.s);
              if (!verdict && !coin) {
                return (
                  <div key={r.horizon} className="flex items-baseline gap-2 font-mono text-xs">
                    <span className="w-16 shrink-0 text-muted">{r.label}</span>
                    <span className="text-faint">awaiting more matured calls</span>
                  </div>
                );
              }
              return (
                <div key={r.horizon} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-xs">
                  <span className="w-16 shrink-0 text-muted">{r.label}</span>
                  {verdict ? (
                    <span className={verdict.cls}>
                      <span aria-hidden>{verdict.glyph}</span> {verdict.text}
                    </span>
                  ) : (
                    <span className="text-faint">CRPS pending</span>
                  )}
                  {coin && (
                    <span className="text-faint">
                      · direction <span className={coin.cls}><span aria-hidden>{coin.glyph}</span> {coin.text}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-4 border-t border-keyline pt-3 font-mono text-[11px] leading-relaxed text-faint">
        Orange is the model&rsquo;s scored claim; this panel measures it against reality. A bar that
        sits on the zero line means the forecast is doing about as well as &ldquo;no change&rdquo; —
        which, for Bitcoin over these horizons, is an honest place to be.
      </p>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { fetchActualPrices } from "@/lib/data";
import { resolveCall, type Call } from "@/lib/yourcall";

const KEY = "btc-oracle-calls-v1";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function load(): Call[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(calls: Call[]) { localStorage.setItem(KEY, JSON.stringify(calls)); }

/** "Play along" sidebar — a restrained, just-for-fun wager against the model.
 *  Two keyline buttons (fill only on hover), the model's lean in mono, and a
 *  resolved tally set like a scoreline. Nothing is sold; nothing leaves the
 *  browser. KEEPS the existing localStorage game logic verbatim. */
export function YourCall({ spot, modelPup }: { spot: number | null; modelPup: number | null }) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [prices, setPrices] = useState<{ t: number; price: number }[]>([]);
  useEffect(() => { setCalls(load()); fetchActualPrices(60).then(setPrices); }, []);

  const makeCall = (userUp: boolean) => {
    if (!spot || modelPup === null) return;
    const now = Date.now();
    const next = [{ id: String(now), createdAt: now, targetAt: now + WEEK, spotAtPick: spot, userUp, modelPup }, ...calls].slice(0, 20);
    setCalls(next); save(next);
  };

  const resolved = calls.map((c) => ({ c, r: resolveCall(c, prices) })).filter((x) => x.r.resolved);
  const youHit = resolved.filter((x) => x.r.userRight).length;
  const modelHit = resolved.filter((x) => x.r.modelRight).length;

  const canPlay = spot != null && modelPup !== null;
  const modelUp = modelPup !== null && modelPup >= 0.5;

  return (
    <div className="anim-fade-up rounded-md border border-keyline bg-surface p-5">
      <div className="kicker">Play along</div>
      <h3 className="mt-2 font-display text-lg leading-snug text-ink">
        Where is BTC in a week — and can you beat the model?
      </h3>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => makeCall(true)}
          disabled={!canPlay}
          className="rounded-sm border border-keyline px-3 py-1.5 font-mono text-sm text-up transition-colors hover:bg-up/12 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>▲</span> Higher
        </button>
        <button
          type="button"
          onClick={() => makeCall(false)}
          disabled={!canPlay}
          className="rounded-sm border border-keyline px-3 py-1.5 font-mono text-sm text-down transition-colors hover:bg-down/12 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>▼</span> Lower
        </button>
        {modelPup !== null && (
          <span className="font-mono text-[11px] text-faint tnum">
            model leans {modelUp ? "higher" : "lower"} ({Math.round(modelPup * 100)}%)
          </span>
        )}
      </div>

      {resolved.length > 0 ? (
        <div className="mt-4 border-t border-keyline pt-3">
          <div className="font-mono text-[11px] uppercase tracking-wide text-faint">resolved tally</div>
          <div className="mt-1 font-mono text-lg text-ink tnum">
            you {youHit}/{resolved.length}
            <span className="px-2 text-faint">·</span>
            model {modelHit}/{resolved.length}
          </div>
        </div>
      ) : (
        <p className="mt-4 border-t border-keyline pt-3 font-mono text-[11px] leading-relaxed text-faint">
          {calls.length > 0
            ? "no calls resolved yet — each one settles a week after you make it."
            : "make a call to start — your first one settles a week from now."}
        </p>
      )}

      {calls.length > 0 && (
        <ul className="mt-3 divide-y divide-keyline">
          {calls.slice(0, 6).map((c) => {
            const r = resolveCall(c, prices);
            return (
              <li key={c.id} className="flex items-center justify-between py-1.5 font-mono text-[11px]">
                <span className="text-muted">
                  you said {c.userUp ? "higher" : "lower"}
                </span>
                {!r.resolved ? (
                  <span className="text-faint">pending</span>
                ) : (
                  <span className={r.userRight ? "text-up" : "text-down"}>
                    <span aria-hidden>{r.userRight ? "✓" : "✗"}</span>{" "}
                    {r.userRight ? "you were right" : "you missed"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 font-mono text-[10px] text-faint">
        just for fun, stored only in your browser.
      </p>
    </div>
  );
}

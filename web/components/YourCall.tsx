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

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Your call vs. the model</h3>
      <p className="mt-2 text-sm text-zinc-400">Where do you think BTC is in 1 week — and can you beat the model? (Just for fun, stored only in your browser.)</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => makeCall(true)} className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/25">▲ Higher</button>
        <button onClick={() => makeCall(false)} className="rounded-md bg-rose-500/15 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/25">▼ Lower</button>
        {modelPup !== null && <span className="self-center text-xs text-zinc-500">model leans {modelPup >= 0.5 ? "higher" : "lower"} ({Math.round(modelPup * 100)}%)</span>}
      </div>
      {resolved.length > 0 && (
        <div className="mt-3 text-sm text-zinc-300">
          Resolved calls: <span className="text-zinc-100">you {youHit}/{resolved.length}</span> · <span className="text-zinc-100">model {modelHit}/{resolved.length}</span>
        </div>
      )}
      {calls.length > 0 && (
        <ul className="mt-2 divide-y divide-zinc-800 text-xs">
          {calls.slice(0, 6).map((c) => {
            const r = resolveCall(c, prices);
            const status = !r.resolved ? "pending" : r.userRight ? "✓ you were right" : "✗ you missed";
            return <li key={c.id} className="flex justify-between py-1.5 text-zinc-500">
              <span>you said {c.userUp ? "higher" : "lower"}</span><span className={r.resolved ? (r.userRight ? "text-emerald-400" : "text-rose-400") : "text-zinc-600"}>{status}</span>
            </li>;
          })}
        </ul>
      )}
    </div>
  );
}

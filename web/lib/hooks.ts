"use client";
import { useEffect, useRef, useState } from "react";
import type { Latest, History, Scores, Extras } from "./types";
import { fetchLatest, fetchHeavy, fetchLiveSpot } from "./data";

export type Dir = "up" | "down" | "flat";

export function priceDirection(prev: number | null, next: number): Dir {
  if (prev === null || prev === undefined) return "flat";
  if (next > prev) return "up";
  if (next < prev) return "down";
  return "flat";
}

const hidden = () => typeof document !== "undefined" && document.hidden;

/** Poll the live BTC spot (from CoinGecko, not our host) every `ms`; pause while the tab is hidden. */
export function useLivePrice(ms = 30_000): { price: number | null; dir: Dir } {
  const [price, setPrice] = useState<number | null>(null);
  const [dir, setDir] = useState<Dir>("flat");
  const prev = useRef<number | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (hidden()) return;
      const p = await fetchLiveSpot();
      if (!alive || p === null) return;
      setDir(priceDirection(prev.current, p));
      prev.current = p;
      setPrice(p);
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ms]);
  return { price, dir };
}

export interface LiveData {
  latest: Latest | null;
  history: History | null;
  scores: Scores | null;
  extras: Extras | null;
  error: string | null;
  updatedAt: number | null;
}

/**
 * Poll forecast snapshots so new hourly runs appear, without hammering the host.
 *
 * The data only changes once an hour, so this is deliberately gentle — an
 * earlier version polled four cache-busted files every 60s, which the host's
 * firewall flagged as scraping and used to ban visitor IPs. To stay well under
 * that threshold we:
 *   - poll every 5 minutes (was 60s),
 *   - pause entirely while the tab is hidden (and refresh on return),
 *   - back off exponentially on errors (so an outage/block isn't retried hard),
 *   - fetch only the small `latest.json` each tick, refetching the heavier
 *     history/scores/extras only when a new run (`run_at`) actually appears.
 */
export function useLiveData(ms = 300_000): LiveData {
  const [data, setData] = useState<LiveData>({
    latest: null, history: null, scores: null, extras: null, error: null, updatedAt: null,
  });
  const seenRunAt = useRef<string | null>(null);
  const heavy = useRef<{ history: History | null; scores: Scores | null; extras: Extras | null }>({
    history: null, scores: null, extras: null,
  });
  useEffect(() => {
    let alive = true;
    let running = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      if (!alive || running) return;
      if (hidden()) { schedule(ms); return; } // skip the network while backgrounded
      running = true;
      let nextDelay = ms;
      try {
        const latest = await fetchLatest();
        if (!alive) return;
        if (latest.run_at !== seenRunAt.current) {
          try {
            heavy.current = await fetchHeavy();
            seenRunAt.current = latest.run_at;
          } catch {
            /* keep prior heavy data; retry it on the next poll */
          }
        }
        setData({
          latest,
          history: heavy.current.history,
          scores: heavy.current.scores,
          extras: heavy.current.extras,
          error: null,
          updatedAt: Date.now(),
        });
        failures = 0;
      } catch (e) {
        if (!alive) return;
        failures += 1;
        setData((d) => ({ ...d, error: String(e) }));
        nextDelay = Math.min(ms * 2 ** failures, 30 * 60_000); // cap backoff at 30 min
      } finally {
        running = false;
      }
      if (alive) schedule(nextDelay);
    };

    run();
    const onVisible = () => { if (!hidden()) schedule(0); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms]);
  return data;
}

/** Smoothly animate a number toward `target` (browser only; falls back to the value). */
export function useCountUp(target: number | null, ms = 600): number | null {
  const [val, setVal] = useState<number | null>(target);
  const fromRef = useRef<number | null>(target);
  const valRef = useRef<number | null>(target);
  useEffect(() => {
    if (target === null) return;
    // Snapshot the current displayed value so mid-animation interruptions start
    // from the current visual position rather than the stale animation origin.
    const from = valRef.current ?? fromRef.current ?? target;
    fromRef.current = target;
    if (from === target) { setVal(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * eased;
      valRef.current = next;
      setVal(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

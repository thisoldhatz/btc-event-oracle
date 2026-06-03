"use client";
import { useEffect, useRef, useState } from "react";
import type { Latest, History, Scores, Extras } from "./types";
import { fetchSnapshots, fetchLiveSpot } from "./data";

export type Dir = "up" | "down" | "flat";

export function priceDirection(prev: number | null, next: number): Dir {
  if (prev === null || prev === undefined) return "flat";
  if (next > prev) return "up";
  if (next < prev) return "down";
  return "flat";
}

/** Poll the live BTC spot every `ms`, exposing the latest price + tick direction. */
export function useLivePrice(ms = 15_000): { price: number | null; dir: Dir } {
  const [price, setPrice] = useState<number | null>(null);
  const [dir, setDir] = useState<Dir>("flat");
  const prev = useRef<number | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
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

/** Fetch the snapshots on mount and re-fetch every `ms` so new hourly runs appear. */
export function useLiveData(ms = 60_000): LiveData {
  const [data, setData] = useState<LiveData>({
    latest: null, history: null, scores: null, extras: null, error: null, updatedAt: null,
  });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { latest, history, scores, extras } = await fetchSnapshots();
        if (!alive) return;
        setData({ latest, history, scores, extras, error: null, updatedAt: Date.now() });
      } catch (e) {
        if (alive) setData((d) => ({ ...d, error: String(e) }));
      }
    };
    load();
    const id = setInterval(load, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ms]);
  return data;
}

/** Smoothly animate a number toward `target` (browser only; falls back to the value). */
export function useCountUp(target: number | null, ms = 600): number | null {
  const [val, setVal] = useState<number | null>(target);
  const fromRef = useRef<number | null>(target);
  useEffect(() => {
    if (target === null) return;
    const from = fromRef.current ?? target;
    if (from === target) { setVal(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

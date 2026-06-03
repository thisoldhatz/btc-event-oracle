"use client";
import { useEffect, useState } from "react";
import type { Latest, History, Scores } from "@/lib/types";
import { fetchSnapshots, fetchLiveSpot } from "@/lib/data";
import { sortForecasts } from "@/lib/format";
import { Header } from "@/components/Header";
import { HorizonCard } from "@/components/HorizonCard";
import { ForecastChart } from "@/components/ForecastChart";
import { Scorecard } from "@/components/Scorecard";
import { RationalePanel } from "@/components/RationalePanel";
import { Disclaimer } from "@/components/Disclaimer";

export default function Page() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshots()
      .then(({ latest, history, scores }) => {
        setLatest(latest);
        setHistory(history);
        setScores(scores);
      })
      .catch((e) => setError(String(e)));
    fetchLiveSpot().then(setLive);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Header latest={latest} livePrice={live} />

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Could not load forecast data ({error}).
        </div>
      )}

      {!latest && !error && (
        <div className="mt-10 text-center text-zinc-500">Loading the latest forecast…</div>
      )}

      {latest && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortForecasts(latest.forecasts).map((f) => (
              <HorizonCard key={f.horizon} f={f} />
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">{history && <ForecastChart history={history} />}</div>
            <RationalePanel latest={latest} />
          </section>

          <section className="mt-4">{scores && <Scorecard scores={scores} />}</section>
        </>
      )}

      <Disclaimer />
    </main>
  );
}

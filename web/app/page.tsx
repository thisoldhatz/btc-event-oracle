"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sortForecasts } from "@/lib/format";
import { useLiveData, useLivePrice } from "@/lib/hooks";
import { Header } from "@/components/Header";
import { SignalsStrip } from "@/components/SignalsStrip";
import { HorizonCard } from "@/components/HorizonCard";
import { ForecastChart } from "@/components/ForecastChart";
import { Scorecard } from "@/components/Scorecard";
import { RationalePanel } from "@/components/RationalePanel";
import { NewsFeed } from "@/components/NewsFeed";
import { Disclaimer } from "@/components/Disclaimer";

export default function Page() {
  const { latest, history, scores, error, updatedAt } = useLiveData(60_000);
  const { price, dir } = useLivePrice(15_000);

  // tick a clock every 15s so "updated Xs ago" / relative times stay fresh
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Header latest={latest} livePrice={price} dir={dir} updatedAt={updatedAt} now={now} />

      <Link
        href="/guide/"
        className="mt-4 flex items-center justify-between rounded-lg border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2.5 text-sm text-zinc-200 transition-colors hover:bg-[#f7931a]/15"
      >
        <span>
          <span className="mr-1.5">👋</span> New here? Read the plain-English guide to what every
          number on this page means.
        </span>
        <span className="ml-3 shrink-0 text-[#f7931a]">How to read this →</span>
      </Link>

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Couldn&apos;t load forecast data ({error}).
        </div>
      )}
      {!latest && !error && (
        <div className="mt-10 text-center text-zinc-500">Loading the latest forecast…</div>
      )}

      {latest && (
        <>
          <SignalsStrip signals={latest.signals ?? []} />

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortForecasts(latest.forecasts).map((f) => (
              <HorizonCard key={f.horizon} f={f} />
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">{history && <ForecastChart history={history} />}</div>
            <RationalePanel latest={latest} />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">{scores && <Scorecard scores={scores} />}</div>
            <NewsFeed news={latest.news ?? []} />
          </section>
        </>
      )}

      <Disclaimer />
    </main>
  );
}

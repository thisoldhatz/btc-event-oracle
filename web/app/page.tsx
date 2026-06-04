"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sortForecasts, relativeTime, regimeNote } from "@/lib/format";
import { useLiveData, useLivePrice } from "@/lib/hooks";
import { Header } from "@/components/Header";
import { SignalsStrip } from "@/components/SignalsStrip";
import { FearGreedDial } from "@/components/FearGreedDial";
import { HorizonCard } from "@/components/HorizonCard";
import { ForecastChart } from "@/components/ForecastChart";
import { Scorecard } from "@/components/Scorecard";
import { RationalePanel } from "@/components/RationalePanel";
import { RecentCalls } from "@/components/RecentCalls";
import { MindTimeline } from "@/components/MindTimeline";
import { NewsFeed } from "@/components/NewsFeed";
import { Disclaimer } from "@/components/Disclaimer";
import { MarketsPanel } from "@/components/MarketsPanel";
import { SkillPanel } from "@/components/SkillPanel";
import { YourCall } from "@/components/YourCall";

export default function Page() {
  const { latest, history, scores, extras, error, updatedAt } = useLiveData(60_000);
  const { price, dir } = useLivePrice(15_000);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const fng = latest?.signals?.find((s) => s.signal === "fear_greed");
  const otherSignals = (latest?.signals ?? []).filter((s) => s.signal !== "fear_greed");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Header latest={latest} livePrice={price} dir={dir} updatedAt={updatedAt} now={now} />

      <Link href="/guide/" className="mt-4 flex items-center justify-between rounded-lg border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2.5 text-sm text-zinc-200 transition-colors hover:bg-[#f7931a]/15">
        <span><span className="mr-1.5">👋</span> New here? Read the plain-English guide to what every number on this page means.</span>
        <span className="ml-3 shrink-0 text-[#f7931a]">How to read this →</span>
      </Link>

      {latest?.run_at && now - Date.parse(latest.run_at) > 90 * 60 * 1000 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
          ⚠ Heads up — data may be stale: the last forecast update was {relativeTime(latest.run_at, now)} (it normally refreshes hourly).
        </div>
      )}

      {latest?.regime && regimeNote(latest.regime.label) && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
          ⚠ {regimeNote(latest.regime.label)}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Couldn&apos;t load forecast data ({error}).
        </div>
      )}
      {!latest && !error && <div className="mt-10 text-center text-zinc-500">Loading the latest forecast…</div>}

      {latest && (
        <>
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">What the model is watching</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {fng && <FearGreedDial value={fng.value ?? 0} />}
              <div className={fng ? "sm:col-span-1 lg:col-span-3" : "sm:col-span-2 lg:col-span-4"}>
                <SignalsStrip signals={otherSignals} />
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortForecasts(latest.forecasts).map((f) => (
              <HorizonCard key={f.horizon} f={f} now={now} />
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">{history && <ForecastChart history={history} />}</div>
            <RationalePanel latest={latest} />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {scores && <Scorecard scores={scores} />}
              {scores && <SkillPanel scores={scores} />}
              {extras && <RecentCalls results={extras.results} />}
            </div>
            <div className="space-y-4">
              <MarketsPanel markets={latest.markets ?? []} />
              <YourCall spot={price ?? latest.spot} modelPup={sortForecasts(latest.forecasts).find((f) => f.horizon === "1w")?.p_up ?? null} />
              {extras && <MindTimeline timeline={extras.timeline} />}
              <NewsFeed news={latest.news ?? []} />
            </div>
          </section>
        </>
      )}

      <Disclaimer />
    </main>
  );
}

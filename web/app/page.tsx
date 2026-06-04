"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sortForecasts, relativeTime, regimeNote, fmtUsd, fmtPct } from "@/lib/format";
import { useLiveData, useLivePrice } from "@/lib/hooks";
import { Masthead } from "@/components/Masthead";
import { Section, Standfirst } from "@/components/Section";
import { SignalsStrip } from "@/components/SignalsStrip";
import { FearGreedDial } from "@/components/FearGreedDial";
import { ProbabilityFan } from "@/components/ProbabilityFan";
import { HorizonTriptych } from "@/components/HorizonTriptych";
import { ForecastChart } from "@/components/ForecastChart";
import { RationalePanel } from "@/components/RationalePanel";
import { Scorecard } from "@/components/Scorecard";
import { SkillPanel } from "@/components/SkillPanel";
import { ReliabilityDiagram } from "@/components/ReliabilityDiagram";
import { PitHistogram } from "@/components/PitHistogram";
import { HeadToHead } from "@/components/HeadToHead";
import { RecentCalls } from "@/components/RecentCalls";
import { MindTimeline } from "@/components/MindTimeline";
import { NewsFeed } from "@/components/NewsFeed";
import { MarketsPanel } from "@/components/MarketsPanel";
import { YourCall } from "@/components/YourCall";
import { Disclaimer } from "@/components/Disclaimer";

export default function Page() {
  const { latest, history, scores, extras, error, updatedAt } = useLiveData();
  const { price, dir } = useLivePrice();
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const fng = latest?.signals?.find((s) => s.signal === "fear_greed");
  const otherSignals = (latest?.signals ?? []).filter((s) => s.signal !== "fear_greed");
  const sorted = latest ? sortForecasts(latest.forecasts) : [];
  const wk = sorted.find((f) => f.horizon === "1w") ?? sorted[0];
  const spot = price ?? latest?.spot ?? null;
  const cal = scores?.["1w"]?.calibration;
  const stale = latest?.run_at && now - Date.parse(latest.run_at) > 90 * 60 * 1000;

  return (
    <main className="px-4 pb-24">
      <Masthead latest={latest} livePrice={price} dir={dir} updatedAt={updatedAt} now={now} />
      <div className="mx-auto max-w-ledger">
        <Link
          href="/guide/"
          className="mt-6 flex items-center justify-between border-b border-keyline pb-3 text-sm text-muted transition-colors hover:text-ink"
        >
          <span><span className="mr-1.5">👋</span>New here? Read the plain-English guide to every number on this page.</span>
          <span className="ml-3 shrink-0 text-accent">How to read this →</span>
        </Link>

        {stale && (
          <div className="mt-4 border-l-2 border-caution pl-3 text-sm italic text-caution/90">
            Heads up — the last forecast update was {relativeTime(latest!.run_at!, now)} (it normally refreshes hourly).
          </div>
        )}
        {latest?.regime && regimeNote(latest.regime.label) && (
          <div className="mt-3 border-l-2 border-caution/60 pl-3 text-xs italic text-caution/80">{regimeNote(latest.regime.label)}</div>
        )}
        {error && (
          <div className="mt-6 border-l-2 border-down pl-3 text-sm text-down">
            {error.includes("BLOCKED") ? (
              <>This device looks temporarily blocked by the host&apos;s firewall, so the live data can&apos;t load. Try again on a different network (e.g. mobile data), or reload in a few minutes — the block usually clears on its own.</>
            ) : (
              <>Couldn&apos;t load forecast data ({error}).</>
            )}
          </div>
        )}
        {!latest && !error && <div className="mt-16 text-center text-faint">Loading the latest forecast…</div>}

        {latest && wk && (
          <>
            <Section kicker="What the model is watching" act="I">
              <div className="grid gap-px overflow-hidden rounded-sm border border-keyline bg-keyline sm:grid-cols-2 lg:grid-cols-4">
                {fng && <div className="bg-base p-4"><FearGreedDial value={fng.value ?? 0} /></div>}
                <div className={`bg-base p-4 ${fng ? "sm:col-span-1 lg:col-span-3" : "sm:col-span-2 lg:col-span-4"}`}>
                  <SignalsStrip signals={otherSignals} />
                </div>
              </div>
            </Section>

            <Section kicker="The one-week call" act="II">
              <h1 className="anim-fade-up font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-tight text-ink">
                Bitcoin, one&nbsp;week&nbsp;out.
              </h1>
              <Standfirst>
                A central guess of <span className="text-ink">{fmtUsd(wk.central)}</span>, most likely between{" "}
                <span className="text-ink">{fmtUsd(wk.lower)}</span> and <span className="text-ink">{fmtUsd(wk.upper)}</span> — P(up){" "}
                <span className="text-ink">{fmtPct(wk.p_up)}</span>
                {Math.abs(wk.p_up - 0.5) < 0.06 ? ", essentially a coin-flip." : "."}
              </Standfirst>
              <div className="mt-6">
                <ProbabilityFan lower={wk.lower} central={wk.central} upper={wk.upper} spot={spot} />
              </div>
              <div className="mt-10">
                <HorizonTriptych forecasts={sorted} now={now} />
              </div>
            </Section>

            <Section kicker="Forecast vs. reality" act="III">
              <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">{history && <ForecastChart history={history} />}</div>
                <RationalePanel latest={latest} />
              </div>
            </Section>

            <Section kicker="The public record" act="IV">
              <Standfirst>We grade ourselves in public, against a coin-flip. Tying it is the honest result.</Standfirst>
              <div className="mt-6 grid gap-8 lg:grid-cols-12">
                <div className="space-y-8 lg:col-span-7">
                  {scores && <Scorecard scores={scores} />}
                  {scores && <SkillPanel scores={scores} />}
                  {extras && <RecentCalls results={extras.results} />}
                </div>
                <div className="space-y-8 lg:col-span-5">
                  <ReliabilityDiagram points={cal?.reliability ?? []} />
                  <PitHistogram bins={cal?.pit_hist ?? []} n={cal?.pit_n ?? 0} />
                </div>
              </div>
            </Section>

            <Section kicker="The model vs. the crowd" act="V">
              <HeadToHead markets={latest.markets ?? []} modelPup={wk.p_up} />
            </Section>

            <Section kicker="In the margins">
              <div className="grid gap-8 lg:grid-cols-3">
                <YourCall spot={spot} modelPup={wk.p_up} />
                <MindTimeline timeline={extras?.timeline ?? []} />
                <div className="space-y-8">
                  <MarketsPanel markets={latest.markets ?? []} />
                  <NewsFeed news={latest.news ?? []} />
                </div>
              </div>
            </Section>
          </>
        )}

        <Disclaimer />
      </div>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeo, SITE } from "@/lib/seo";
import { JsonLd, organizationLd } from "@/components/JsonLd";
import { HORIZON_LABEL, fmtUsd, fmtPct } from "@/lib/format";
import type { Horizon } from "@/lib/types";

export function generateStaticParams() {
  return getSeo().recaps.map((r) => ({ week: r.week }));
}

export async function generateMetadata({
  params,
}: {
  params: { week: string };
}): Promise<Metadata> {
  const recap = getSeo().recaps.find((r) => r.week === params.week);
  if (!recap) {
    return {
      title: `Bitcoin forecast recap — week ${params.week}`,
      description: "Recap not found.",
      alternates: { canonical: `${SITE}/recap/${params.week}/` },
    };
  }
  const hit = recap.hit_rate != null ? fmtPct(recap.hit_rate) : "—";
  const cov = recap.coverage_rate != null ? fmtPct(recap.coverage_rate) : "—";
  const err = recap.avg_pct_err != null ? fmtPct(recap.avg_pct_err) : "—";
  return {
    title: `Bitcoin forecast recap — week ${params.week}`,
    description:
      `Week ${recap.week}: the BTC Event Oracle resolved ${recap.n} Bitcoin ` +
      `forecasts — ${hit} of directional calls correct, ${cov} interval coverage, ` +
      `${err} average price error. Every call scored openly against a random walk.`,
    alternates: { canonical: `${SITE}/recap/${params.week}/` },
  };
}

export default function RecapPage({ params }: { params: { week: string } }) {
  const recap = getSeo().recaps.find((r) => r.week === params.week);
  if (!recap) notFound();

  const hit = recap.hit_rate != null ? fmtPct(recap.hit_rate) : "—";
  const cov = recap.coverage_rate != null ? fmtPct(recap.coverage_rate) : "—";
  const err = recap.avg_pct_err != null ? fmtPct(recap.avg_pct_err) : "—";

  // A dated, quotable lead claim — exactly what an LLM lifts for "how did the BTC forecast do last week?"
  const lead =
    recap.n > 0
      ? `In week ${recap.week} the BTC Event Oracle resolved ${recap.n} ` +
        `${recap.n === 1 ? "call" : "calls"}; ${hit} of directional calls were correct, ` +
        `coverage was ${cov}, and the average price error was ${err}.`
      : `In week ${recap.week} no BTC Event Oracle forecasts had matured yet — ` +
        `this recap fills in as the week's calls come due and are graded against a random walk.`;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Forecast recap — week ${recap.week}`,
    description: lead,
    url: `${SITE}/recap/${recap.week}/`,
    author: organizationLd(),
    publisher: organizationLd(),
    isAccessibleForFree: true,
    keywords: [
      "bitcoin forecast recap",
      "btc weekly forecast review",
      "random walk benchmark",
      "forecast accuracy",
    ],
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <JsonLd data={organizationLd()} />
      <JsonLd data={articleLd} />
      <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink">
        Forecast recap — {recap.week}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{lead}</p>
      <p className="mt-3 leading-relaxed text-muted">
        Every call below was graded against a naive <strong className="text-ink">random walk</strong> —
        the &ldquo;no change&rdquo; benchmark. Short-horizon Bitcoin is close to a random walk, so the
        honest, expected result is to roughly <em>tie</em> it; we publish the week as it landed, misses
        included. See the full live record on the{" "}
        <Link href="/accuracy/" className="text-accent underline underline-offset-2">accuracy page</Link>.
      </p>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">The week in numbers</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-keyline bg-surface p-4">
            <dt className="font-mono text-[11px] uppercase tracking-wide text-faint">Resolved</dt>
            <dd className="mt-1 font-mono text-2xl text-ink tnum">{recap.n}</dd>
          </div>
          <div className="rounded-md border border-keyline bg-surface p-4">
            <dt className="font-mono text-[11px] uppercase tracking-wide text-faint">Hit rate</dt>
            <dd className="mt-1 font-mono text-2xl text-ink tnum">{hit}</dd>
          </div>
          <div className="rounded-md border border-keyline bg-surface p-4">
            <dt className="font-mono text-[11px] uppercase tracking-wide text-faint">Coverage</dt>
            <dd className="mt-1 font-mono text-2xl text-ink tnum">{cov}</dd>
          </div>
          <div className="rounded-md border border-keyline bg-surface p-4">
            <dt className="font-mono text-[11px] uppercase tracking-wide text-faint">Avg error</dt>
            <dd className="mt-1 font-mono text-2xl text-ink tnum">{err}</dd>
          </div>
        </dl>
        <p className="mt-4 max-w-measure font-body text-xs leading-relaxed text-faint">
          Hit rate is the share of up/down calls that landed correctly (50% = a coin-flip). Coverage is
          how often the real price finished inside the stated range. Avg error is the mean % by which the
          central price guess missed the realised price.
        </p>
      </section>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">Every call, graded</h2>
        {recap.items.length === 0 ? (
          <p className="mt-3 font-body text-sm italic leading-relaxed text-faint">
            No calls matured in this window yet — this table fills in as the week&apos;s forecasts come
            due.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider text-left font-mono text-[11px] uppercase tracking-wide text-faint">
                  <th className="py-2 pr-4">Horizon</th>
                  <th className="py-2 pr-4">Said</th>
                  <th className="py-2 pr-4">Actual</th>
                  <th className="py-2 pr-4 text-right">Est.</th>
                  <th className="py-2 pr-4 text-right">Realised</th>
                  <th className="py-2 pr-4">Range</th>
                  <th className="py-2 text-right">Call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-keyline">
                {recap.items.map((it, i) => {
                  const saidUp = it.p_up >= 0.5;
                  const actualUp = it.up_outcome >= 0.5;
                  const hitCall = saidUp === actualUp;
                  const inRange = it.covered === true;
                  const said = saidUp ? "up" : "down";
                  const actual = actualUp ? "up" : "down";
                  return (
                    <tr key={`${it.horizon}-${it.target_at}-${i}`} className="font-mono text-ink tnum">
                      <td className="py-3 pr-4 font-display text-base">
                        {HORIZON_LABEL[it.horizon as Horizon] ?? it.horizon}
                      </td>
                      <td className={`py-3 pr-4 ${saidUp ? "text-up" : "text-down"}`}>{said}</td>
                      <td className={`py-3 pr-4 ${actualUp ? "text-up" : "text-down"}`}>{actual}</td>
                      <td className="py-3 pr-4 text-right">{fmtUsd(it.central)}</td>
                      <td className="py-3 pr-4 text-right">{fmtUsd(it.realized_price)}</td>
                      <td className="py-3 pr-4 text-muted">
                        {it.covered == null ? "—" : inRange ? "in range" : "out of range"}
                      </td>
                      <td className="py-3 text-right">
                        {hitCall ? (
                          <span className="text-up">✓ hit</span>
                        ) : (
                          <span className="text-down">✗ miss</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 max-w-measure font-body text-xs leading-relaxed text-faint">
          A <span className="text-up">✓ hit</span> means the directional call matched what actually
          happened; <span className="text-down">✗ miss</span> means it didn&apos;t — the ✓/✗ text carries
          the meaning, never colour alone. At short horizons Bitcoin behaves close to a random walk, so a
          mixed week is the normal, honest outcome rather than a broken model.
        </p>
      </section>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">Keep reading</h2>
        <ul className="mt-3 space-y-2 text-muted">
          <li>
            ·{" "}
            <Link href="/accuracy/" className="text-accent underline underline-offset-2">
              The full accuracy record — scored vs a random walk
            </Link>
          </li>
          <li>
            ·{" "}
            <Link href="/" className="text-accent underline underline-offset-2">
              The live dashboard — this hour&apos;s forecast
            </Link>
          </li>
        </ul>
      </section>

      <div className="mt-12 border-t border-keyline pt-5">
        <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

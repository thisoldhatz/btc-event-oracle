import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeo, SITE, SIGNALS } from "@/lib/seo";
import { JsonLd, organizationLd } from "@/components/JsonLd";
import { fmtDateTime } from "@/lib/format";

export async function generateStaticParams() {
  return Object.keys(SIGNALS).map((name) => ({ name }));
}

export async function generateMetadata({
  params,
}: {
  params: { name: string };
}): Promise<Metadata> {
  const meta = SIGNALS[params.name];
  if (!meta) {
    return { title: "Signal not found · BTC Event Oracle" };
  }
  return {
    title: `${meta.title} — what it is and how it moves the Bitcoin forecast`,
    description: meta.short,
    alternates: { canonical: `${SITE}/signals/${params.name}/` },
  };
}

// The reading's raw number rendered with its unit — the SEO pages show the value
// exactly as the engine observed it (no client-side helpers), with an honest dash
// when a feed was missing for that hour.
function fmtValue(value: number | null, unit: string): string {
  if (value === null || value === undefined) return "—";
  const n = Math.abs(value) >= 100 ? Math.round(value).toLocaleString("en-US") : value.toString();
  return unit ? `${n}${unit}` : n;
}

export default function SignalPage({ params }: { params: { name: string } }) {
  const meta = SIGNALS[params.name];
  if (!meta) notFound();

  const seo = getSeo();
  const points = (seo.signals[meta.key] ?? [])
    .slice()
    .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at));
  const latest = points[0] ?? null;
  const recent = points.slice(0, 14);

  const others = Object.entries(SIGNALS).filter(([slug]) => slug !== params.name);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${meta.title} — what it is and how it moves the Bitcoin forecast`,
    description: meta.short,
    url: `${SITE}/signals/${params.name}/`,
    isAccessibleForFree: true,
    author: organizationLd(),
    publisher: organizationLd(),
    articleBody: meta.body,
    about: meta.title,
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is the ${meta.title}?`,
        acceptedAnswer: { "@type": "Answer", text: meta.short },
      },
      {
        "@type": "Question",
        name: `Does the ${meta.title} predict Bitcoin's price?`,
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "No. On its own it predicts nothing — it is one contextual input among several. The BTC Event Oracle reads it each hour to inform how wide and how confident its forecast range should be, within hard caps, and then scores every forecast openly against a random-walk benchmark. It is not a buy or sell signal and not financial advice.",
        },
      },
    ],
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <JsonLd data={organizationLd()} />
      <JsonLd data={articleLd} />
      <JsonLd data={faqLd} />
      <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink">{meta.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{meta.short}</p>
      <p className="mt-3 leading-relaxed text-muted">{meta.body}</p>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">Recent readings</h2>
        {latest ? (
          <>
            <div className="mt-4 rounded-md border border-keyline bg-surface p-5">
              <div className="font-mono text-3xl text-ink tnum">{fmtValue(latest.value, meta.unit)}</div>
              <div className="mt-1 font-mono text-xs uppercase tracking-wide text-faint">
                latest · {fmtDateTime(latest.observed_at)}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{latest.interpretation}</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divider text-left font-mono text-[11px] uppercase tracking-wide text-faint">
                    <th className="py-2 pr-4">Observed</th>
                    <th className="py-2 pr-4 text-right">Value</th>
                    <th className="py-2">Reading</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-keyline">
                  {recent.map((p) => (
                    <tr key={p.observed_at} className="align-top">
                      <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-muted tnum">
                        {fmtDateTime(p.observed_at)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right font-mono text-ink tnum">
                        {fmtValue(p.value, meta.unit)}
                      </td>
                      <td className="py-3 text-muted">{p.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-4 font-body text-sm italic leading-relaxed text-faint">
            No readings recorded yet — this fills in as the engine logs the signal each hour. The{" "}
            <Link href="/" className="text-accent underline underline-offset-2">live dashboard</Link>{" "}
            shows the current value.
          </p>
        )}
      </section>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">How the Oracle uses it</h2>
        <p className="mt-3 leading-relaxed text-muted">
          This is <strong className="text-ink">one signal among several</strong>, never a directional call on
          its own. The forecast starts as plain math (a GJR-GARCH volatility model); the signal is read each
          hour as context, and Claude may make small, <strong className="text-ink">hard-capped</strong>{" "}
          adjustments to the range and confidence — it can&apos;t swing the guess wildly. Every forecast is
          then scored openly against a random-walk benchmark, so you can judge the result rather than trust
          it. See the{" "}
          <Link href="/accuracy/" className="text-accent underline underline-offset-2">accuracy record</Link>{" "}
          and the{" "}
          <Link href="/methodology/" className="text-accent underline underline-offset-2">full methodology</Link>.
        </p>
      </section>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">The other signals</h2>
        <ul className="mt-3 space-y-2 text-muted">
          {others.map(([slug, s]) => (
            <li key={slug}>
              ·{" "}
              <Link href={`/signals/${slug}/`} className="text-accent underline underline-offset-2">
                {s.title}
              </Link>{" "}
              — {s.short}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 border-t border-keyline pt-5">
        <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

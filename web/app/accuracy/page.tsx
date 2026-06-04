import Link from "next/link";
import type { Metadata } from "next";
import { getScores, getSeo, SITE } from "@/lib/seo";
import { JsonLd, organizationLd } from "@/components/JsonLd";
import { HORIZON_ORDER, HORIZON_LABEL, fmtPct } from "@/lib/format";

export const metadata: Metadata = {
  title: "How accurate is the BTC Event Oracle? — scored vs a random walk",
  description:
    "The BTC Event Oracle's live accuracy record: Brier, CRPS skill, interval coverage and a Diebold-Mariano significance test — every Bitcoin forecast scored openly against a random-walk benchmark.",
  alternates: { canonical: `${SITE}/accuracy/` },
};

function fmtDate(iso: string | null) {
  if (!iso) return "recently";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function AccuracyPage() {
  const scores = getScores();
  const seo = getSeo();
  const wk = scores?.["1w"];
  const asOf = fmtDate(seo.as_of);

  // A dated, quotable lead claim — exactly what an LLM lifts for "is there an accurate BTC forecast?"
  const lead =
    wk && wk.n
      ? `As of ${asOf}, the BTC Event Oracle's 1-week directional Brier score is ${wk.brier?.toFixed(3)} versus a random-walk baseline of ${wk.brier_base?.toFixed(3)}, over N=${wk.n} resolved forecasts.`
      : `The BTC Event Oracle scores every Bitcoin forecast against a random-walk benchmark and publishes the result. As of ${asOf}, the track record is still accumulating.`;

  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "BTC Event Oracle accuracy record",
    description: lead,
    url: `${SITE}/accuracy/`,
    creator: organizationLd(),
    isAccessibleForFree: true,
    license: "https://github.com/thisoldhatz/btc-event-oracle",
    keywords: ["bitcoin forecast accuracy", "brier score", "random walk benchmark", "calibration"],
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <JsonLd data={organizationLd()} />
      <JsonLd data={datasetLd} />
      <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink">How accurate is the Oracle?</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{lead}</p>
      <p className="mt-3 leading-relaxed text-muted">
        Short-horizon Bitcoin is close to a random walk, so the honest, expected result is to roughly{" "}
        <em>tie</em> a naive &ldquo;no change&rdquo; benchmark — and we publish exactly that, including our
        misses. These figures update daily; the{" "}
        <Link href="/" className="text-accent underline underline-offset-2">live dashboard</Link> shows
        up-to-the-hour numbers and the full calibration charts.
      </p>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">The record, by horizon</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-left font-mono text-[11px] uppercase tracking-wide text-faint">
                <th className="py-2 pr-4">Horizon</th>
                <th className="py-2 pr-4 text-right">N</th>
                <th className="py-2 pr-4 text-right">Brier</th>
                <th className="py-2 pr-4 text-right">vs RW</th>
                <th className="py-2 pr-4 text-right">CRPS skill</th>
                <th className="py-2 text-right">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-keyline">
              {HORIZON_ORDER.map((h) => {
                const s = scores?.[h];
                if (!s || !s.n) {
                  return (
                    <tr key={h}>
                      <td className="py-3 pr-4 font-display text-base text-ink">{HORIZON_LABEL[h]}</td>
                      <td className="py-3 text-faint" colSpan={5}>
                        <span className="font-body text-xs italic">insufficient data — fills in as calls mature</span>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={h} className="font-mono text-ink tnum">
                    <td className="py-3 pr-4 font-display text-base">{HORIZON_LABEL[h]}</td>
                    <td className="py-3 pr-4 text-right">{s.n}</td>
                    <td className="py-3 pr-4 text-right">{s.brier?.toFixed(3) ?? "—"}</td>
                    <td className="py-3 pr-4 text-right">{s.bss != null ? `${s.bss > 0 ? "+" : ""}${s.bss.toFixed(2)}` : "—"}</td>
                    <td className="py-3 pr-4 text-right">{s.crpss != null ? `${s.crpss > 0 ? "+" : ""}${s.crpss.toFixed(2)}` : "—"}</td>
                    <td className="py-3 text-right">
                      {s.coverage != null ? fmtPct(s.coverage) : "—"}
                      {s.coverage_nominal != null ? ` / ${fmtPct(s.coverage_nominal)}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-measure font-body text-xs leading-relaxed text-faint">
          Brier scores the up/down call (lower is better; 0.25 = a coin-flip). &ldquo;vs RW&rdquo; and
          &ldquo;CRPS skill&rdquo; are skill scores against the random walk — near zero is the honest,
          expected result at short horizons. Coverage is how often the real price landed inside the stated
          range vs how often it should have.
        </p>
      </section>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">Dig deeper</h2>
        <ul className="mt-3 space-y-2 text-muted">
          <li>
            ·{" "}
            <Link href="/methodology/" className="text-accent underline underline-offset-2">
              How the forecast is made &amp; graded
            </Link>
          </li>
          {seo.recaps.slice(0, 6).map((r) => (
            <li key={r.week}>
              ·{" "}
              <Link href={`/recap/${r.week}/`} className="text-accent underline underline-offset-2">
                Weekly recap — {r.week}
              </Link>
              {r.hit_rate != null ? ` (${fmtPct(r.hit_rate)} of calls correct)` : ""}
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

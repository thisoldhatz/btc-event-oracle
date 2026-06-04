import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/seo";
import { JsonLd, organizationLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "How the BTC Event Oracle works — methodology",
  description:
    "How the BTC Event Oracle builds and grades its Bitcoin forecast: a GJR-GARCH volatility baseline with a regime check, a hard-capped Claude overlay on top, and proper scoring (Brier, CRPS, coverage, calibration, Diebold-Mariano) against a random-walk benchmark.",
  alternates: { canonical: `${SITE}/methodology/` },
};

export default function MethodologyPage() {
  // A quotable, honest lead claim — what an LLM lifts for "how does the BTC Event Oracle work?"
  const lead =
    "Each hour the BTC Event Oracle builds a Bitcoin price forecast in two stages — a GJR-GARCH volatility baseline, then a small, hard-capped Claude overlay — and grades every forecast when it matures against a random-walk benchmark using proper scoring rules.";

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How the BTC Event Oracle works — methodology",
    description: lead,
    author: organizationLd(),
    url: `${SITE}/methodology/`,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <JsonLd data={organizationLd()} />
      <JsonLd data={articleLd} />
      <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink">How the forecast is made &amp; graded</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{lead}</p>
      <p className="mt-3 leading-relaxed text-muted">
        The design goal is honesty, not hype: a transparent quant core, a tightly-bounded AI nudge that
        can never run away, and an open scorecard that defaults to claiming <em>no</em> skill until the
        evidence earns it. Here is exactly how each piece works.
      </p>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">1 · The quant baseline</h2>
        <p className="mt-3 leading-relaxed text-muted">
          The forecast starts as plain mathematics, before any AI is involved. We model Bitcoin&apos;s
          volatility with a <strong className="text-ink">GJR-GARCH</strong> process — a
          variant of GARCH that is <strong className="text-ink">asymmetric</strong>: it lets downside shocks
          raise expected volatility more than equally-sized upside shocks, the well-documented
          &ldquo;leverage effect.&rdquo; For crypto returns, which are fat-tailed and cluster in bursts, this
          asymmetric model fits the data better than simpler constant-volatility or symmetric estimates.
          A lighter <strong className="text-ink">EWMA</strong> volatility estimate is kept as a fail-soft
          fallback if the GARCH fit does not converge.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          On top of that, a <strong className="text-ink">volatility-regime check</strong> classifies the
          current market as calm, elevated, or turbulent and{" "}
          <strong className="text-ink">widens the forecast band</strong> when conditions are stressed — so the
          stated range honestly reflects that the model is less reliable in turbulence. From the resulting
          volatility term structure we build a <strong className="text-ink">lognormal price range</strong> and a{" "}
          <strong className="text-ink">probability of finishing up</strong> (&ldquo;P(up)&rdquo;) for each horizon —
          <span className="font-mono tnum"> 1 week</span>, <span className="font-mono tnum">1 month</span>, and{" "}
          <span className="font-mono tnum">1 year</span>. The band is always wider for longer horizons,
          because the further out you look, the blurrier the future.
        </p>
      </section>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">2 · The bounded AI overlay</h2>
        <p className="mt-3 leading-relaxed text-muted">
          Only after the baseline exists does the AI get a turn. Anthropic&apos;s{" "}
          <strong className="text-ink">Claude</strong> reads a condensed set of real-world event signals and
          applies a <strong className="text-ink">small, hard-capped adjustment</strong> to the baseline&apos;s drift
          and volatility — never a wild swing. The clamps are deliberately tight (drift moves are limited to
          a few tens of basis points, the volatility multiplier to a narrow band, and P(up) is pinned away
          from the extremes), so a confident-sounding model can <em>never</em> hijack the forecast. If the
          overlay is unavailable or returns anything out of range, the system is{" "}
          <strong className="text-ink">fully fail-soft</strong> and simply publishes the quant baseline.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          The signals Claude reads are each explained, with current readings, on their own pages:
        </p>
        <ul className="mt-3 space-y-2 text-muted">
          <li>
            ·{" "}
            <Link href="/signals/fear-greed/" className="text-accent underline underline-offset-2">
              Crypto Fear &amp; Greed Index
            </Link>{" "}
            — market sentiment, 0–100.
          </li>
          <li>
            ·{" "}
            <Link href="/signals/funding/" className="text-accent underline underline-offset-2">
              Perpetual funding rate
            </Link>{" "}
            — leverage crowding (longs vs shorts).
          </li>
          <li>
            ·{" "}
            <Link href="/signals/open-interest/" className="text-accent underline underline-offset-2">
              Open interest
            </Link>{" "}
            — how much leveraged &ldquo;fuel&rdquo; is riding on price.
          </li>
          <li>
            ·{" "}
            <Link href="/signals/implied-vol/" className="text-accent underline underline-offset-2">
              Implied volatility (Deribit DVOL)
            </Link>{" "}
            — the options market&apos;s forward-looking swing estimate.
          </li>
          <li>
            ·{" "}
            <Link href="/signals/news-tone/" className="text-accent underline underline-offset-2">
              News tone (GDELT)
            </Link>{" "}
            — whether global Bitcoin coverage is net positive or negative.
          </li>
        </ul>
      </section>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">3 · How it&apos;s graded</h2>
        <p className="mt-3 leading-relaxed text-muted">
          Every forecast is timestamped and then <strong className="text-ink">scored when it matures</strong>{" "}
          against what actually happened — and against the toughest fair benchmark there is, the{" "}
          <strong className="text-ink">random walk</strong> (assume the price simply stays where it is). We use{" "}
          <strong className="text-ink">proper scoring rules</strong>, which can&apos;t be gamed by shading the
          numbers:
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-keyline bg-surface p-4">
            <dt className="font-display text-ink">Brier score — direction</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              Grades the up/down probability. Lower is better;{" "}
              <span className="font-mono tnum">0.25</span> is a coin-flip.
            </dd>
          </div>
          <div className="rounded-md border border-keyline bg-surface p-4">
            <dt className="font-display text-ink">CRPS — full distribution</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              Scores the <em>whole</em> predicted range, not just the direction — rewarding sharp ranges that
              still contain the truth.
            </dd>
          </div>
          <div className="rounded-md border border-keyline bg-surface p-4">
            <dt className="font-display text-ink">Interval coverage</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              How often the real price actually landed inside the stated band, versus how often it should
              have. The honest check that the ranges are the right width.
            </dd>
          </div>
          <div className="rounded-md border border-keyline bg-surface p-4">
            <dt className="font-display text-ink">Reliability diagram &amp; PIT histogram</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              Calibration receipts: when we say 60%, does it happen ~60% of the time, and are the ranges the
              right width? Dots on the diagonal and flat PIT bars mean honest numbers.
            </dd>
          </div>
        </dl>
        <p className="mt-4 leading-relaxed text-muted">
          To decide whether any apparent edge over the random walk is <em>real</em> or just luck, we run a{" "}
          <strong className="text-ink">Diebold-Mariano test</strong> with{" "}
          <strong className="text-ink">Newey-West (HAC)</strong> standard errors to handle the overlapping,
          autocorrelated forecast errors. It <strong className="text-ink">defaults to &ldquo;no significant
          difference&rdquo;</strong> and only reports skill once the evidence clears that bar — no overclaiming.
          Finally, we run a <strong className="text-ink">head-to-head against real-money prediction markets</strong>{" "}
          on the same Bitcoin questions and, once those markets resolve, keep score of who was actually
          closer.
        </p>
      </section>

      <section className="mt-10 border-t border-keyline pt-8">
        <h2 className="font-display text-2xl text-ink">4 · Why honesty is the whole point</h2>
        <p className="mt-3 leading-relaxed text-muted">
          Over short horizons, Bitcoin&apos;s price is <strong className="text-ink">close to a random walk</strong> —
          tomorrow&apos;s move is mostly unpredictable from today&apos;s information. So{" "}
          <strong className="text-ink">roughly tying the random-walk benchmark is the honest, expected result</strong>,
          not a failure. A site that claimed to beat the market every week would be lying. The value here is
          the opposite of a crystal ball: a transparent method, well-calibrated uncertainty, and a public
          record you can audit. See the live numbers, by horizon, on the{" "}
          <Link href="/accuracy/" className="text-accent underline underline-offset-2">accuracy page</Link>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-faint">
          This is an educational and portfolio project — model-implied probabilities and ranges, not
          financial advice and never a guarantee. Bitcoin can lose value fast.{" "}
          <Link href="/guide/" className="text-accent underline underline-offset-2">
            Read the plain-English guide →
          </Link>
        </p>
      </section>

      <div className="mt-12 border-t border-keyline pt-5">
        <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

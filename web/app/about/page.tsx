// app/about/page.tsx
import Link from "next/link";

export const metadata = { title: "About & Method · BTC Event Oracle" };

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 font-display text-xl text-ink">{children}</h2>;
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink">About &amp; method</h1>

      <p className="mt-4 leading-relaxed text-muted">
        BTC Event Oracle is an independent, non-commercial, educational project. It receives no
        compensation, promotes no products, and gives no personalized advice — it publishes one
        general, systematic forecast on a fixed hourly schedule. It is not financial advice.
      </p>

      <H2>How the forecast is made</H2>
      <p className="mt-2 leading-relaxed text-muted">
        Each hour a quantitative baseline estimates Bitcoin&apos;s volatility with a{" "}
        <strong className="text-ink">GJR-GARCH</strong> model (an asymmetric volatility model that out-performs
        simpler methods for crypto) and builds a central estimate, a confidence range, and a probability
        of being higher, for 1-week, 1-month, and 1-year horizons. A{" "}
        <strong className="text-ink">volatility-regime</strong> check widens the published range during turbulent
        periods, when any model is less reliable. Then Claude (an LLM) reads condensed world-event
        signals — the Fear &amp; Greed index, perpetual funding, open interest, Deribit implied
        volatility, and news — and applies a <strong className="text-ink">small, hard-capped</strong> adjustment. If the
        model is unavailable, the site falls back to the untouched baseline.
      </p>

      <H2>How it&apos;s graded</H2>
      <p className="mt-2 leading-relaxed text-muted">
        Every forecast is scored when it comes due against a <strong className="text-ink">random-walk</strong> benchmark
        (&quot;tomorrow = today&quot;) using proper scoring rules — Brier for direction, CRPS for the full price
        distribution, and interval coverage for the ranges. We publish the calibration visually (a
        reliability diagram and a PIT histogram), test whether the method <em>significantly</em> beats the
        random walk with a Diebold-Mariano test (Newey-West HAC, which corrects for the overlap between
        hourly forecasts) that defaults to &quot;no significant difference,&quot; and we line our odds up against a
        real-money market and keep score of who&apos;s been closer. Skill near zero means the method roughly
        ties a coin flip — the honest, expected result at short horizons.
      </p>

      <H2>Honesty &amp; limits</H2>
      <p className="mt-2 leading-relaxed text-muted">
        Nobody can reliably predict Bitcoin&apos;s price. This site exists to show a transparent method and
        hold it accountable — not to promise returns. Read the{" "}
        <Link href="/guide/" className="text-accent underline underline-offset-2">plain-English guide</Link> and the{" "}
        <Link href="/disclaimer/" className="text-accent underline underline-offset-2">full disclaimer</Link>.
      </p>

      <div className="mt-12 border-t border-keyline pt-5">
        <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

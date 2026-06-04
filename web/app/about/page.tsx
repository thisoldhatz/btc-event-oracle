// app/about/page.tsx
import Link from "next/link";

export const metadata = { title: "About & Method · BTC Event Oracle" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-300">
      <Link href="/" className="text-sm text-[#f7931a]">← Back to the dashboard</Link>
      <h1 className="mt-4 text-3xl font-bold text-zinc-50">About &amp; method</h1>

      <p className="mt-3 text-sm leading-relaxed">
        BTC Event Oracle is an independent, non-commercial, educational project. It receives no
        compensation, promotes no products, and gives no personalized advice — it publishes one
        general, systematic forecast on a fixed hourly schedule. It is not financial advice.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-100">How the forecast is made</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Each hour a quantitative baseline estimates Bitcoin&apos;s volatility with a <strong>GJR-GARCH</strong>
        model (an asymmetric volatility model that out-performs simpler methods for crypto) and builds a
        central estimate, a confidence range, and a probability of being higher, for 1-week, 1-month, and
        1-year horizons. A <strong>volatility-regime</strong> check widens the published range during
        turbulent periods, when any model is less reliable. Then Claude (an LLM) reads condensed
        world-event signals — the Fear &amp; Greed index, perpetual funding, open interest, Deribit
        implied volatility, and news — and applies a <strong>small, hard-capped</strong> adjustment.
        If the model is unavailable, the site falls back to the untouched baseline.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-100">How it&apos;s graded</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Every forecast is scored when it comes due against a <strong>random-walk</strong> benchmark
        (&quot;tomorrow = today&quot;) using proper scoring rules — Brier score for direction, CRPS for the
        full price distribution, and interval coverage for the ranges — and we compare the Claude-adjusted
        forecast against the raw baseline. Skill scores near zero mean the method roughly ties a coin flip,
        which is the honest, expected result at short horizons. We publish the track record, N, and our
        misses openly.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-100">Honesty &amp; limits</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Nobody can reliably predict Bitcoin&apos;s price. This site exists to show a transparent method and
        hold it accountable — not to promise returns. Read the{" "}
        <Link href="/guide/" className="text-[#f7931a] underline">plain-English guide</Link> and the{" "}
        <Link href="/disclaimer/" className="text-[#f7931a] underline">full disclaimer</Link>.
      </p>

      <div className="mt-10 border-t border-zinc-800 pt-5">
        <Link href="/" className="text-sm text-[#f7931a]">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

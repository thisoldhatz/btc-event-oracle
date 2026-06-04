import Link from "next/link";

export const metadata = { title: "Disclaimer · BTC Event Oracle" };

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 font-display text-xl text-ink">{children}</h2>;
}

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      <h1 className="mt-5 font-display text-3xl font-bold leading-tight text-ink">Disclaimer &amp; method</h1>

      <H2>Not financial advice</H2>
      <p className="mt-2 leading-relaxed text-muted">
        This is an educational / portfolio project. It is not financial advice and does not come
        from a registered broker or investment adviser. Everything shown is a model-implied
        probability or range — never a guarantee. Past and backtested performance does not predict
        future results. Bitcoin is highly volatile and you can lose your entire investment. Use at
        your own risk and consult a licensed professional before making any decision.
      </p>

      <H2>How it works</H2>
      <p className="mt-2 leading-relaxed text-muted">
        Each hour, a quantitative baseline (a GJR-GARCH volatility model over recent prices) produces a
        central estimate, a confidence range, and a probability that BTC is higher at each horizon.
        Claude (an LLM) then reads condensed world-event signals — news tone, the Fear &amp; Greed index,
        perp funding, open interest, and implied volatility — and applies a small, hard-bounded
        adjustment to drift and volatility. If the model is unavailable, the site falls back to the
        untouched baseline.
      </p>

      <H2>Why honesty matters here</H2>
      <p className="mt-2 leading-relaxed text-muted">
        At short horizons Bitcoin behaves much like a random walk, so the model is <em>expected</em> to
        roughly tie a naive &ldquo;no change&rdquo; benchmark. The public record reports exactly that —
        the calibration, the significance test, and our misses — including when the method fails to beat
        the random walk. The value of this site is its transparency and its track record, not a promise
        of returns.
      </p>

      <div className="mt-12 border-t border-keyline pt-5">
        <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export const metadata = { title: "Disclaimer · BTC Event Oracle" };

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-300">
      <Link href="/" className="text-sm text-[#f7931a]">← Back to the dashboard</Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-50">Disclaimer & Method</h1>

      <h2 className="mt-6 text-lg font-semibold text-zinc-100">Not financial advice</h2>
      <p className="mt-2 text-sm leading-relaxed">
        This is an educational / portfolio project. It is not financial advice and does not come
        from a registered broker or investment adviser. Everything shown is a model-implied
        probability or range — never a guarantee. Past and backtested performance does not predict
        future results. Bitcoin is highly volatile and you can lose your entire investment. Use at
        your own risk and consult a licensed professional before making any decision.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-zinc-100">How it works</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Each hour, a quantitative baseline (a random-walk model with volatility estimated from
        recent prices) produces a central estimate, a confidence range, and a probability that BTC
        is higher at each horizon. Claude (an LLM) then reads condensed world-event signals — news
        tone, the Fear &amp; Greed index, perp funding and open interest — and applies a small,
        hard-bounded adjustment to drift and volatility. If the model is unavailable, the site falls
        back to the untouched baseline.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-zinc-100">Why honesty matters here</h2>
      <p className="mt-2 text-sm leading-relaxed">
        At short horizons Bitcoin behaves much like a random walk, so the model is <em>expected</em>
        to roughly tie a naive &ldquo;no change&rdquo; benchmark. The accuracy scorecard reports exactly that —
        including when the method fails to beat random walk. The value of this site is its
        transparency and its track record, not a promise of returns.
      </p>
    </main>
  );
}

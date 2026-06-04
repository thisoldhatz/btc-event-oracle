import Link from "next/link";

export const metadata = { title: "How to read this · BTC Event Oracle" };

function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-keyline bg-surface p-4">
      <dt className="font-display text-ink">{term}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-muted">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-keyline pt-8">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink">How to read this dashboard</h1>
      <p className="mt-3 leading-relaxed text-muted">
        A plain-English guide — no finance background needed. Every section below matches something
        you see on the main page.
      </p>

      <div className="mt-8 rounded-md border-l-2 border-accent bg-surface p-5">
        <h2 className="font-display text-lg text-ink">The one thing to understand first</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="text-ink">Nobody can actually predict Bitcoin&apos;s price.</strong> If they could, they&apos;d
          quietly get rich instead of running a website. So this is <em>not</em> a crystal ball, and
          you should never bet money based on it. What it really is: a computer program that makes an
          honest <em>best guess</em>, explains its reasoning, shows how unsure it is, and — most
          importantly — <strong className="text-ink">keeps score of how right it&apos;s been</strong> over time. The value
          here is the transparency and the track record, not a promise.
        </p>
      </div>

      <Section title="What the site does, in one sentence">
        <p className="text-sm leading-relaxed text-muted">
          Every hour it reads the news and the mood of the crypto market, then publishes a best guess
          for where Bitcoin&apos;s price might be in <strong className="text-ink">1 week</strong>,{" "}
          <strong className="text-ink">1 month</strong>, and <strong className="text-ink">1 year</strong> — always shown as a{" "}
          <strong className="text-ink">range</strong> with odds, never a single magic number.
        </p>
      </Section>

      <Section title="The one-week call & the three horizons">
        <p className="text-sm leading-relaxed text-muted">
          The lead forecast leads with a <strong className="text-ink">band</strong>, not a number — that&apos;s
          deliberate. The shaded orange bar is the most-likely range; the thin tick inside it is just the
          single most-likely point. Below, the same thing for 1 week / 1 month / 1 year:
        </p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Term term="most-likely range (e.g. $61,872 – $69,258)">
            Where the price will <em>probably</em> end up. A <strong className="text-ink">wider band means more
            uncertainty</strong>, and the band always widens for longer time-frames — the further out
            you look, the blurrier the future.
          </Term>
          <Term term="central guess (small, below the range)">
            The single most-likely price — shown small and quiet <em>on purpose</em>, because leading
            with one number would imply a false precision the model doesn&apos;t have. It is not a target
            or a promise.
          </Term>
          <Term term="P(up) — e.g. 49%">
            &quot;Probability up&quot;: the estimated <strong className="text-ink">chance the price is higher than today</strong>{" "}
            by that date. Around 50% is labelled a <strong className="text-ink">coin-flip</strong> — the honest answer for
            Bitcoin most of the time. Muted green for up, muted red for down (never bright — a colour is
            never a buy signal here).
          </Term>
          <Term term="resolves in …">
            How long until this forecast comes due and gets graded against what actually happened.
          </Term>
        </dl>
      </Section>

      <Section title="“What the model is watching” — the signals">
        <p className="text-sm leading-relaxed text-muted">
          These cells are the real-world things the program reads before guessing — the &quot;world events&quot;
          in the name. A small <strong className="text-ink">stale</strong> tag appears if a feed hasn&apos;t updated
          recently, so a frozen signal never quietly looks live.
        </p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Term term="Fear & Greed (e.g. 11/100)">
            A crypto <strong className="text-ink">mood gauge</strong> from 0 (&quot;Extreme Fear&quot;) to 100 (&quot;Extreme
            Greed&quot;). A very low number means the market is fearful — which, historically, has sometimes
            been a <em>buying</em> opportunity.
          </Term>
          <Term term="Perp funding (e.g. +0.0081%)">
            A small fee traders using <strong className="text-ink">borrowed money</strong> pay each few hours. Positive
            means more people are betting up — a &quot;crowded&quot; market that can snap back.
          </Term>
          <Term term="Open interest & implied volatility">
            How much money is riding on leveraged bets, and how much price-swing the options market is
            pricing in. Both gauge how jumpy things are.
          </Term>
          <Term term="News tone">
            Whether global news coverage of Bitcoin right now is, on balance, positive or negative.
          </Term>
        </dl>
      </Section>

      <Section title="“Forecast vs. reality” — the chart">
        <p className="text-sm leading-relaxed text-muted">
          The <strong className="text-ink">orange</strong> line + shaded band is our forecast over time; the{" "}
          <strong className="text-ink" style={{ color: "#7CA9D8" }}>blue</strong> line is what actually happened. The{" "}
          <strong className="text-ink">dotted line</strong> is the &quot;random walk&quot; — the naive &quot;no change&quot;
          benchmark we grade ourselves against, drawn right in the chart so you can <em>see</em> how close
          to a coin-flip short-horizon Bitcoin really is.
        </p>
      </Section>

      <Section title="“Why it moved” — the AI nudge">
        <p className="text-sm leading-relaxed text-muted">
          The forecast starts as plain math (a GJR-GARCH volatility model). Then Anthropic&apos;s{" "}
          <strong className="text-ink">Claude</strong> reads the signals and writes a short explanation of why it nudged
          the guess and widened or tightened the range. It is <strong className="text-ink">only allowed small,
          hard-capped adjustments</strong> — it can&apos;t swing the forecast wildly, which keeps it honest.
          A quiet <strong className="text-ink">&quot;Claude overlay&quot;</strong> chip means the AI was involved this hour;
          &quot;baseline only&quot; means you&apos;re seeing the plain math.
        </p>
      </Section>

      <Section title="“The public record” — the honesty centerpiece">
        <p className="text-sm leading-relaxed text-muted">
          The most important part: it grades the site&apos;s own past guesses, so you can judge whether
          it&apos;s any good instead of just trusting it.
        </p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Term term="“Random walk”">
            The simplest possible &quot;prediction&quot;: assume the price stays exactly where it is. It sounds
            dumb but is famously hard to beat — so every forecast is graded against it. If we can&apos;t
            beat &quot;no change,&quot; we say so.
          </Term>
          <Term term="The accuracy ledger (N · Brier · MAPE · Coverage)">
            N = how many forecasts have come due; Brier = the up/down score (lower better); MAPE = the
            average % the price guess was off; Coverage = how often reality landed inside the band vs how
            often it should have. The little bar shows skill <em>vs the random walk</em> — centered = a tie.
          </Term>
          <Term term="The reliability diagram (“the receipts”)">
            When we say 60%, does it happen ~60% of the time? Each dot plots what we said against what
            actually occurred; dots on the diagonal line mean honest probabilities.
          </Term>
          <Term term="The PIT histogram">
            A check that the <em>ranges</em> are the right width. Flat bars = well-calibrated; lopsided
            bars mean the bands are systematically too wide or too narrow.
          </Term>
          <Term term="“Beats the random walk?”">
            A proper statistical test (Diebold-Mariano) that <strong className="text-ink">defaults to &quot;no significant
            difference&quot;</strong> and only claims skill once the evidence clears it. No overclaiming.
          </Term>
          <Term term="The model vs. the crowd">
            We line up our odds against a real-money prediction market (Polymarket) on the same question,
            and — once those markets resolve — keep score of who&apos;s actually been closer.
          </Term>
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-faint">
          <strong className="text-muted">What &quot;good&quot; looks like here:</strong> for short horizons, roughly{" "}
          <em>tying</em> the random walk is the realistic, credible result — and we publish it openly
          rather than hiding it. A site that claims to crush the market every week is lying.
        </p>
      </Section>

      <Section title="Should I trade on this?">
        <p className="text-sm leading-relaxed text-muted">
          <strong className="text-ink">No.</strong> This is an educational and portfolio project, not financial advice and
          not from a licensed adviser. The forecasts are model-implied probabilities and ranges, not
          guarantees, and Bitcoin can lose value fast. If you&apos;re making real financial decisions,
          talk to a licensed professional.{" "}
          <Link href="/disclaimer/" className="text-accent underline underline-offset-2">
            Read the full disclaimer &amp; method →
          </Link>
        </p>
      </Section>

      <div className="mt-12 border-t border-keyline pt-5">
        <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

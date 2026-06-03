import Link from "next/link";

export const metadata = { title: "How to read this · BTC Event Oracle" };

function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <dt className="font-semibold text-zinc-100">{term}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-zinc-400">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-300">
      <Link href="/" className="text-sm text-[#f7931a]">← Back to the dashboard</Link>
      <h1 className="mt-4 text-3xl font-bold text-zinc-50">How to read this dashboard</h1>
      <p className="mt-2 text-zinc-400">
        A plain-English guide — no finance background needed. Every section below matches something
        you see on the main page.
      </p>

      <div className="mt-6 rounded-xl border border-[#f7931a]/30 bg-[#f7931a]/10 p-5">
        <h2 className="text-lg font-bold text-zinc-50">The one thing to understand first</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          <strong>Nobody can actually predict Bitcoin&apos;s price.</strong> If they could, they&apos;d
          quietly get rich instead of running a website. So this is <em>not</em> a crystal ball, and
          you should never bet money based on it. What it really is: a computer program that makes an
          honest <em>best guess</em>, explains its reasoning, shows how unsure it is, and — most
          importantly — <strong>keeps score of how right it&apos;s been</strong> over time. The value
          here is the transparency and the track record, not a promise.
        </p>
      </div>

      <Section title="What the site does, in one sentence">
        <p className="text-sm leading-relaxed">
          Every hour, it looks at the news and the mood of the crypto market, then publishes a best
          guess for where Bitcoin&apos;s price might be in <strong>1 week</strong>,{" "}
          <strong>1 month</strong>, and <strong>1 year</strong> — always shown as a range with a
          confidence level, never a single magic number.
        </p>
      </Section>

      <Section title="The three forecast cards (1 Week / 1 Month / 1 Year)">
        <p className="text-sm leading-relaxed">Each card is one best guess. Here&apos;s every number on it:</p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Term term="The big number (e.g. $65,461)">
            The <strong>central estimate</strong> — the single most-likely price, the middle of the
            guess. It is not a target or a promise.
          </Term>
          <Term term="range $61,872 – $69,258">
            Where the price will <em>probably</em> end up. There&apos;s roughly a 60% chance the real
            price lands inside this band. A <strong>wider band means more uncertainty</strong>, and
            the band always gets wider for longer time-frames — because the further out you look, the
            blurrier the future is.
          </Term>
          <Term term="P(up) — e.g. 49%">
            &quot;Probability up.&quot; The estimated <strong>chance the price is higher than today</strong>{" "}
            by that date. Around 50% basically means a coin-flip — which is the honest answer for
            Bitcoin most of the time. It&apos;s green when it&apos;s 50% or more, red when it&apos;s below.
          </Term>
          <Term term="low / medium / high confidence">
            How sure the model is about this guess. It&apos;s usually <strong>&quot;low&quot;</strong>,
            on purpose — Bitcoin is genuinely hard to predict, and pretending to be confident would be
            dishonest.
          </Term>
          <Term term="drift −20 bps · vol ×1.15">
            The small, capped adjustments the AI made after reading the news (see &quot;the AI nudge&quot;
            below). <strong>drift</strong> is a tiny up/down tilt to the estimate; <strong>vol&nbsp;×</strong>{" "}
            is how much it widened the range because things look jumpy (×1.15 = 15% wider). These are
            deliberately kept small.
          </Term>
        </dl>
      </Section>

      <Section title="“What the model is watching” — the signals strip">
        <p className="text-sm leading-relaxed">
          These tiles are the real-world things the program reads before guessing. They&apos;re the
          &quot;world events&quot; in the name.
        </p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Term term="Fear & Greed (e.g. 11/100)">
            A popular crypto <strong>mood gauge</strong> from 0 (&quot;Extreme Fear&quot; — everyone&apos;s
            scared and selling) to 100 (&quot;Extreme Greed&quot; — everyone&apos;s euphoric and buying).
            A very low number like 11 means the market is fearful. Interestingly, extreme fear has
            historically sometimes been a <em>buying</em> opportunity.
          </Term>
          <Term term="Perp funding (e.g. +0.0081%)">
            A small fee that traders using <strong>borrowed money</strong> pay each few hours. When
            it&apos;s positive, more people are betting the price goes <em>up</em> — which can mean the
            market is &quot;crowded&quot; and more likely to snap back with a sharp drop.
          </Term>
          <Term term="Open interest (e.g. 58,473)">
            How much money is currently riding on those leveraged bets. A high number means there&apos;s
            more &quot;fuel&quot; for big, fast price swings in either direction.
          </Term>
          <Term term="News tone">
            Whether global news coverage of Bitcoin right now is, on balance, positive or negative.
          </Term>
        </dl>
      </Section>

      <Section title="“Forecast over time” — the chart">
        <p className="text-sm leading-relaxed">
          This shows how the guess has changed over time. The <strong>shaded band</strong> is the
          range (low to high), and the <strong>line</strong> is the central estimate. Use the
          1&nbsp;Week / 1&nbsp;Month / 1&nbsp;Year buttons to switch which forecast you&apos;re looking
          at. When the site is brand new it looks flat — it fills in as more hours pass.
        </p>
      </Section>

      <Section title="“Why it moved” — the AI nudge">
        <p className="text-sm leading-relaxed">
          The forecast starts as plain math (a simple statistical model). Then an AI assistant
          (Anthropic&apos;s <strong>Claude</strong>) reads the signals above and writes a short
          explanation of why it nudged the guess up or down and widened or tightened the range. That
          explanation is shown here in its own words. Crucially, the AI is <strong>only allowed to
          make small adjustments</strong> — it can&apos;t swing the forecast wildly, which keeps it
          honest. The green <strong>&quot;Claude overlay&quot;</strong> badge at the top means the AI
          was involved this hour; <strong>&quot;baseline only&quot;</strong> means it wasn&apos;t
          available and you&apos;re seeing the plain math.
        </p>
      </Section>

      <Section title="“Accuracy scorecard · vs. random walk” — the honesty centerpiece">
        <p className="text-sm leading-relaxed">
          This is the most important part: it grades the site&apos;s own past guesses, so you can judge
          whether it&apos;s any good instead of just trusting it.
        </p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Term term="“Random walk”">
            The simplest possible &quot;prediction&quot;: assume next week&apos;s price is exactly
            today&apos;s price. It sounds dumb, but it&apos;s famously hard to beat — so we grade every
            forecast against it. If we can&apos;t beat &quot;no change,&quot; we say so.
          </Term>
          <Term term="N">
            How many past forecasts have <strong>come due</strong> (reached their target date) and been
            graded so far.
          </Term>
          <Term term="Brier">
            A score for the up/down probability calls. <strong>Lower is better</strong> (0 would be
            perfect).
          </Term>
          <Term term="MAPE">
            The average percentage the price estimate was off by. <strong>Lower is better</strong>.
          </Term>
          <Term term="Cover">
            How often the real price actually landed <strong>inside the predicted range</strong>.
            Ideally this is close to the 60% the range claims.
          </Term>
          <Term term="Verdict">
            Plain-English summary: &quot;beating random walk,&quot; &quot;≈ random walk (expected),&quot;
            or &quot;worse than random walk.&quot;
          </Term>
          <Term term="“Insufficient data”">
            Not enough forecasts have come due yet to grade fairly. The 1-year row will say this for a
            long time — that&apos;s normal and honest.
          </Term>
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          <strong>What &quot;good&quot; looks like here:</strong> for short horizons, roughly{" "}
          <em>tying</em> the random walk is the realistic, credible result — and we publish it openly
          rather than hiding it. A site that claims to crush the market every week is lying.
        </p>
      </Section>

      <Section title="The live bits (top of the page)">
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Term term="Live BTC + the flashing number">
            The current Bitcoin price, refreshed every ~15 seconds. It briefly flashes{" "}
            <span className="text-emerald-400">green</span> when it goes up and{" "}
            <span className="text-rose-400">red</span> when it goes down.
          </Term>
          <Term term="The pulsing “LIVE” dot & “updated …”">
            The page quietly re-checks for new data every minute, so fresh forecasts, signals, and
            headlines appear on their own — no need to reload.
          </Term>
          <Term term="Latest Bitcoin headlines">
            A live feed of recent crypto news (from CoinDesk and Cointelegraph) with how long ago each
            was published. These are some of the same world events the model considers.
          </Term>
          <Term term="“forecast as of …”">
            The timestamp of the most recent hourly forecast (separate from the live price, which
            updates more often).
          </Term>
        </dl>
      </Section>

      <Section title="Should I trade on this?">
        <p className="text-sm leading-relaxed">
          <strong>No.</strong> This is an educational and portfolio project, not financial advice and
          not from a licensed adviser. The forecasts are model-implied probabilities and ranges, not
          guarantees, and Bitcoin can lose value fast. If you&apos;re making real financial decisions,
          talk to a licensed professional.{" "}
          <Link href="/disclaimer/" className="text-[#f7931a] underline">
            Read the full disclaimer &amp; method →
          </Link>
        </p>
      </Section>

      <div className="mt-10 border-t border-zinc-800 pt-5">
        <Link href="/" className="text-sm text-[#f7931a]">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

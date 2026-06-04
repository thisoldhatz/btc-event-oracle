import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/seo";
import { JsonLd, organizationLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Who runs the BTC Event Oracle?",
  description:
    "The BTC Event Oracle is an independent, non-commercial, educational project. It takes no compensation, promotes nothing, and gives no personalized advice — its credibility is its open, scored track record and its open-source code.",
  alternates: { canonical: `${SITE}/who/` },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 font-display text-2xl text-ink">{children}</h2>;
}

export default function WhoPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <JsonLd data={organizationLd()} />
      <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-ink">Who runs the BTC Event Oracle?</h1>

      <p className="mt-4 text-lg leading-relaxed text-muted">
        The BTC Event Oracle is an <strong className="text-ink">independent, non-commercial, educational
        project</strong>. It takes no compensation, sells nothing, promotes nothing, and gives no
        personalized advice — its only claim to your trust is an open, scored track record and
        fully open-source code.
      </p>

      <section className="mt-10 border-t border-keyline pt-8">
        <div className="rounded-md border-l-2 border-accent bg-surface p-5">
          <p className="text-sm leading-relaxed text-muted">
            We deliberately don&apos;t lead with a person&apos;s name or a résumé, because{" "}
            <strong className="text-ink">on this site credentials don&apos;t matter — the receipts do</strong>.
            Every forecast is timestamped, published in advance, and graded openly against a
            random-walk benchmark. You don&apos;t have to trust the author; you can check the score.
          </p>
        </div>
      </section>

      <H2>What it is</H2>
      <p className="mt-2 leading-relaxed text-muted">
        A single, systematic Bitcoin forecast, published on a fixed hourly schedule for the 1-week,
        1-month, and 1-year horizons — each as a price range plus a probability, never a single magic
        number. A quantitative <strong className="text-ink">GJR-GARCH</strong> baseline does the math; Claude (an
        LLM) reads condensed world-event signals and applies a small, hard-capped adjustment. It is a
        transparency-and-accountability exercise, not a tip service.
      </p>

      <H2>What it isn&apos;t</H2>
      <p className="mt-2 leading-relaxed text-muted">
        It is <strong className="text-ink">not financial advice</strong>, not a signal group, and not run by a
        licensed adviser. Nothing here is personalized to you, nothing is monetized, and no product,
        token, exchange, or affiliate link is being promoted. There is nothing to buy and nothing to
        sign up for. If you are making real financial decisions, talk to a licensed professional.
      </p>

      <H2>Why you can trust it (or not)</H2>
      <p className="mt-2 leading-relaxed text-muted">
        Credibility here rests on two open things, not on authority:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>
          ·{" "}
          <strong className="text-ink">An open, scored track record.</strong> Every call is graded when it comes
          due, including the misses, with proper scoring rules.{" "}
          <Link href="/accuracy/" className="text-accent underline underline-offset-2">
            See the accuracy record →
          </Link>
        </li>
        <li>
          ·{" "}
          <strong className="text-ink">Open-source code.</strong> The engine, the model, and the grading are
          all public — you can read exactly how every number is produced.{" "}
          <a
            href="https://github.com/thisoldhatz/btc-event-oracle"
            className="text-accent underline underline-offset-2"
            rel="noopener noreferrer"
          >
            Read the source on GitHub →
          </a>
        </li>
      </ul>
      <p className="mt-3 leading-relaxed text-muted">
        For exactly how the forecast is built and graded, read the{" "}
        <Link href="/methodology/" className="text-accent underline underline-offset-2">methodology</Link>.
      </p>

      <H2>The honest bottom line</H2>
      <p className="mt-2 leading-relaxed text-muted">
        Nobody can reliably predict Bitcoin&apos;s price, and this project never pretends otherwise —
        at short horizons it&apos;s <em>expected</em> to roughly tie a naive &ldquo;no change&rdquo;
        guess, and it says so out loud. The point isn&apos;t to be a crystal ball; it&apos;s to show a
        method in the open and hold it accountable. Read the full{" "}
        <Link href="/disclaimer/" className="text-accent underline underline-offset-2">disclaimer</Link>.
      </p>

      <div className="mt-12 border-t border-keyline pt-5">
        <Link href="/" className="font-mono text-sm text-accent">← Back to the dashboard</Link>
      </div>
    </main>
  );
}

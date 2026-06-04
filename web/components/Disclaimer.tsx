import Link from "next/link";

/** The closing COLOPHON. A full-bleed top hairline, then a quiet, unembarrassed
 *  statement of method across the measure — the band/range is a tracked method,
 *  never a promise. No urgency, no hedging theatre; just the standing facts and
 *  the three doors that explain them. */
export function Disclaimer() {
  return (
    <footer className="mt-16 border-t border-keyline pt-6">
      <p className="max-w-measure font-body text-xs leading-relaxed text-faint">
        Not financial advice. Short-horizon Bitcoin is near-random-walk; this is a
        tracked method, not a prediction of certainty.{" "}
        <Link href="/guide/" className="underline decoration-faint underline-offset-2 transition-colors hover:text-muted">
          Guide
        </Link>
        {" · "}
        <Link href="/about/" className="underline decoration-faint underline-offset-2 transition-colors hover:text-muted">
          About
        </Link>
        {" · "}
        <Link href="/disclaimer/" className="underline decoration-faint underline-offset-2 transition-colors hover:text-muted">
          Full disclaimer
        </Link>
      </p>
    </footer>
  );
}

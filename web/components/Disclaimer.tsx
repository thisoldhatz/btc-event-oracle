import Link from "next/link";

export function Disclaimer() {
  return (
    <footer className="mt-10 border-t border-zinc-800 pt-5 text-xs leading-relaxed text-zinc-500">
      <p>
        <strong className="text-zinc-400">Educational / portfolio project — not financial advice.</strong>{" "}
        These are model-implied probabilities and ranges, not guarantees; past and backtested
        performance does not predict future results. Bitcoin is highly volatile and you can lose
        your entire investment. Use at your own risk and consult a licensed professional.{" "}
        <Link href="/disclaimer/" className="text-zinc-400 underline">
          Full disclaimer &amp; method
        </Link>
        .
      </p>
    </footer>
  );
}

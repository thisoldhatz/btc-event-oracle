"use client";
import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";
import { relativeTime } from "@/lib/format";

/** A plain dateline list — no cards, no boxes. Source in small mono caps, the
 *  headline in body type as a quiet link, the published time in mono. Hairline
 *  rules separate entries. The news is context, never a call to action. */
export function NewsFeed({ news }: { news: NewsItem[] }) {
  // re-tick relative timestamps every 30s so "Xm ago" stays honest
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!news || news.length === 0) {
    return (
      <p className="max-w-measure font-body text-sm leading-relaxed text-faint">
        No recent headlines.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-keyline">
      {news.map((n, i) => (
        <li key={n.url + i} className="py-3.5 first:pt-0">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              {n.source}
            </span>
            {n.published_at && (
              <span className="shrink-0 font-mono text-[10px] text-faint tnum">
                {relativeTime(n.published_at, now)}
              </span>
            )}
          </div>
          <a
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block font-body text-[0.95rem] leading-snug text-ink decoration-accent underline-offset-2 hover:text-accent hover:underline"
          >
            {n.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

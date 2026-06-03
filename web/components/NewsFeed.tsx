"use client";
import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";
import { relativeTime } from "@/lib/format";

export function NewsFeed({ news }: { news: NewsItem[] }) {
  // re-tick relative timestamps every 30s so "Xm ago" stays honest
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Latest Bitcoin headlines
      </h3>
      {(!news || news.length === 0) ? (
        <p className="mt-3 text-sm text-zinc-600">No headlines right now.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-800">
          {news.map((n, i) => (
            <li key={n.url + i} className="py-2.5">
              <a href={n.url} target="_blank" rel="noopener noreferrer"
                 className="text-sm text-zinc-200 hover:text-[#f7931a]">
                {n.title}
              </a>
              <div className="mt-0.5 text-xs text-zinc-500">
                {n.source}
                {n.published_at && <> · {relativeTime(n.published_at, now)}</>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

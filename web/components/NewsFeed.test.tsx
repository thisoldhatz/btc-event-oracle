// components/NewsFeed.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsFeed } from "@/components/NewsFeed";
import type { NewsItem } from "@/lib/types";

const news: NewsItem[] = [
  { title: "Bitcoin tags new high", url: "https://x.com/a", source: "CoinDesk", published_at: "2026-06-03T20:33:51+00:00" },
  { title: "Ether slips below 1800", url: "https://x.com/b", source: "Cointelegraph", published_at: "2026-06-03T16:09:12+00:00" },
];

describe("NewsFeed", () => {
  it("renders headlines as links with source", () => {
    render(<NewsFeed news={news} />);
    const link = screen.getByRole("link", { name: /Bitcoin tags new high/ });
    expect(link).toHaveAttribute("href", "https://x.com/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/CoinDesk/)).toBeInTheDocument();
  });
  it("shows an empty state when no news", () => {
    render(<NewsFeed news={[]} />);
    expect(screen.getByText(/no headlines/i)).toBeInTheDocument();
  });
});

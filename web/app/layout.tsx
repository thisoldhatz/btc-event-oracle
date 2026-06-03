import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTC Event Oracle",
  description: "Honest hourly Bitcoin forecasting driven by world events, scored against random walk.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 antialiased">{children}</body>
    </html>
  );
}

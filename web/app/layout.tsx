import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vadym.online"),
  title: "BTC Event Oracle",
  description: "Honest hourly Bitcoin forecasting driven by world events, scored against random walk.",
  openGraph: {
    title: "BTC Event Oracle",
    description: "Honest, hourly Bitcoin forecasts — scored openly against a random walk. Not a crystal ball; a tracked method.",
    url: "https://vadym.online/btc",
    images: [{ url: "/btc/data/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BTC Event Oracle",
    description: "Honest, hourly Bitcoin forecasts — scored openly against a random walk.",
    images: ["/btc/data/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 antialiased">{children}</body>
    </html>
  );
}

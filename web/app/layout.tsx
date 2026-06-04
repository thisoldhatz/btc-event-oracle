import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Editorial "Ledger" type system — display serif + UI sans + tabular data mono.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap",
});

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

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0B0B0E" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-base font-body text-ink antialiased">{children}</body>
    </html>
  );
}

import type { Config } from "tailwindcss";

// "The Ledger" editorial design tokens — dark, scarce-ink palette.
// orange = a claim the model is being scored on · slate = reality · violet = the market.
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0B0B0E", // page base (warm near-black)
        surface: "#131318", // raised — cards, panels
        sunken: "#0F0F13", // sunken — wells, table rows
        keyline: "#26262E", // hairline rules
        divider: "#3A3A45", // active divider
        ink: "#F4F4F2", // primary text / key numbers
        muted: "#A8A8B3", // secondary text
        faint: "#6B6B76", // captions, axis ticks
        accent: "#F7931A", // Bitcoin orange — the model's scored claim (used sparingly)
        cool: "#7CA9D8", // slate-blue — reality / actual price
        market: "#8B7CD8", // violet — the market / the crowd (Polymarket)
        up: "#5FB58A", // muted editorial green (resolved up / beats benchmark)
        down: "#D9636B", // muted editorial red (resolved down / outside range)
        caution: "#D2A24C", // desaturated amber (stale / elevated regime)
        ideal: "#5B5B66", // calibration "ideal" reference
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: {
        ledger: "1180px",
        measure: "68ch",
      },
    },
  },
  plugins: [],
};
export default config;

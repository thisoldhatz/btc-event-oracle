import { describe, it, expect } from "vitest";
import { fmtUsd, fmtPct, fmtSignedBps, sortForecasts, HORIZON_LABEL, signalStale } from "@/lib/format";
import type { Forecast } from "@/lib/types";

describe("signalStale", () => {
  const now = Date.parse("2026-06-04T12:00:00Z");
  it("flags a day-old Fear & Greed reading as fresh but a 2-day-old one as stale", () => {
    expect(signalStale("2026-06-03T18:00:00Z", "fear_greed", now)!.stale).toBe(false); // 18h < 36h
    expect(signalStale("2026-06-02T06:00:00Z", "fear_greed", now)!.stale).toBe(true); // 54h > 36h
  });
  it("uses a tighter budget for funding and returns null for missing/invalid times", () => {
    expect(signalStale("2026-06-03T20:00:00Z", "funding_rate", now)!.stale).toBe(true); // 16h > 12h
    expect(signalStale("", "funding_rate", now)).toBeNull();
    expect(signalStale("not-a-date", "funding_rate", now)).toBeNull();
  });
});

const mk = (horizon: Forecast["horizon"]): Forecast => ({
  horizon, target_at: "", central: 0, lower: 0, upper: 0, conf_level: 0.6,
  p_up: 0.5, confidence_label: "low", band_width_pct: 0, drift_adj_bps: 0,
  vol_mult: 1, rationale: "",
});

describe("format", () => {
  it("formats USD with thousands separators", () => {
    expect(fmtUsd(65260.4)).toBe("$65,260");
  });
  it("formats probability as percent", () => {
    expect(fmtPct(0.4917)).toBe("49%");
    expect(fmtPct(0.4917, 1)).toBe("49.2%");
  });
  it("formats signed bps", () => {
    expect(fmtSignedBps(-30)).toBe("-30 bps");
    expect(fmtSignedBps(20)).toBe("+20 bps");
  });
  it("sorts forecasts into 1w,1m,1y regardless of input order", () => {
    const sorted = sortForecasts([mk("1m"), mk("1y"), mk("1w")]);
    expect(sorted.map((f) => f.horizon)).toEqual(["1w", "1m", "1y"]);
  });
  it("labels horizons", () => {
    expect(HORIZON_LABEL["1y"]).toBe("1 Year");
  });
});

import { relativeTime, signalDisplay } from "@/lib/format";
import type { Signal } from "@/lib/types";

describe("relativeTime", () => {
  const now = Date.parse("2026-06-03T21:00:00Z");
  it("formats recent times", () => {
    expect(relativeTime("2026-06-03T20:59:30+00:00", now)).toBe("just now");
    expect(relativeTime("2026-06-03T20:45:00+00:00", now)).toBe("15m ago");
    expect(relativeTime("2026-06-03T18:00:00+00:00", now)).toBe("3h ago");
  });
  it("handles empty/invalid", () => {
    expect(relativeTime("", now)).toBe("");
  });
});

describe("signalDisplay", () => {
  const mk = (signal: string, value: number | null, delta: number | null, interp = ""): Signal =>
    ({ source: "x", signal, value, delta, interpretation: interp, observed_at: "" });
  it("formats fear & greed with a fear tone", () => {
    const d = signalDisplay(mk("fear_greed", 11, -12, "Extreme Fear"));
    expect(d.label).toBe("Fear & Greed");
    expect(d.value).toBe("11/100");
    expect(d.tone).toBe("fear");
  });
  it("formats funding as a signed percent", () => {
    const d = signalDisplay(mk("funding_rate", 0.0000814, null));
    expect(d.label).toBe("Perp funding");
    expect(d.value).toBe("+0.0081%");
    expect(d.tone).toBe("up");
  });
  it("formats open interest with separators", () => {
    const d = signalDisplay(mk("open_interest", 58472.86, null));
    expect(d.value).toBe("58,473");
  });
  it("falls back for unknown signals", () => {
    const d = signalDisplay(mk("mystery", 5, null, "hmm"));
    expect(d.label).toBe("mystery");
    expect(d.tone).toBe("neutral");
  });
});

import { timeUntil } from "@/lib/format";
describe("timeUntil", () => {
  const now = Date.parse("2026-06-03T00:00:00Z");
  it("formats days/hours and minutes", () => {
    expect(timeUntil("2026-06-08T03:00:00Z", now)).toBe("5d 3h");
    expect(timeUntil("2026-06-03T02:30:00Z", now)).toBe("2h 30m");
    expect(timeUntil("2026-06-03T00:20:00Z", now)).toBe("20m");
  });
  it("says resolved once past", () => {
    expect(timeUntil("2026-06-02T00:00:00Z", now)).toBe("resolved");
  });
});

import { signalDisplay, regimeNote } from "@/lib/format";
import type { Signal } from "@/lib/types";

describe("DVOL + regime", () => {
  it("labels the dvol implied-vol signal nicely", () => {
    const s: Signal = { source: "dvol", signal: "implied_vol", value: 48.2, delta: -1.5, interpretation: "x", observed_at: "" };
    const d = signalDisplay(s);
    expect(d.label).toBe("Implied vol");
    expect(d.value).toBe("48%");
  });
  it("regimeNote explains widening only when elevated/high", () => {
    expect(regimeNote("normal")).toBe("");
    expect(regimeNote("elevated").toLowerCase()).toContain("widened");
    expect(regimeNote("high").toLowerCase()).toContain("widened");
  });
});

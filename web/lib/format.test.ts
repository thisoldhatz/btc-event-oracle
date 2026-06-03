import { describe, it, expect } from "vitest";
import { fmtUsd, fmtPct, fmtSignedBps, sortForecasts, HORIZON_LABEL } from "@/lib/format";
import type { Forecast } from "@/lib/types";

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

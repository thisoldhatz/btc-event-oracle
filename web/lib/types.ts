export type Horizon = "1w" | "1m" | "1y";

export interface Forecast {
  horizon: Horizon;
  target_at: string;
  central: number;
  lower: number;
  upper: number;
  conf_level: number;
  p_up: number;
  confidence_label: string;
  band_width_pct: number;
  drift_adj_bps: number;
  vol_mult: number;
  rationale: string;
}
export interface Latest {
  run_at: string | null;
  spot: number | null;
  llm_applied: boolean;
  model_id: string | null;
  forecasts: Forecast[];
  signals?: Signal[];
  news?: NewsItem[];
  markets?: Market[];
  regime?: Regime;
}
export interface HistPoint {
  run_at: string;
  target_at: string;
  central: number;
  lower: number;
  upper: number;
  p_up: number;
}
export type History = Record<Horizon, HistPoint[]>;
export interface ScoreH {
  n: number;
  brier?: number;
  brier_base?: number;
  bss?: number | null;
  mape?: number | null;
  coverage?: number;
  crps?: number | null;
  crpss?: number | null;
  reliability?: number | null;
  resolution?: number | null;
  coverage_nominal?: number | null;
  brier_ci?: number | null;
  windows?: Record<"all" | "last30" | "last90", Partial<ScoreH>>;
  ab?: { n: number; model_brier?: number | null; baseline_brier?: number | null; model_crps?: number | null; baseline_crps?: number | null };
  calibration?: Calibration;
}
export interface Calibration {
  reliability: { p: number; o: number; n: number }[];
  pit_hist: { lo: number; hi: number; count: number; freq: number }[];
  mean_pit: number | null;
  pit_n: number;
  pit_chi2: number | null;
}
export type Scores = Record<Horizon, ScoreH>;

export interface Signal {
  source: string;
  signal: string;
  value: number | null;
  delta: number | null;
  interpretation: string;
  observed_at: string;
}
export interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
}

export interface TimelineItem {
  run_at: string;
  p_up: number;
  central: number;
  drift_adj_bps: number;
  vol_mult: number;
  confidence_label: string;
  llm_applied: boolean;
  rationale: string;
}
export interface ResultItem {
  horizon: Horizon;
  run_at: string;
  target_at: string;
  central: number;
  lower: number;
  upper: number;
  p_up: number;
  spot_at_issue: number;
  realized_price: number;
  up_outcome: number;
  covered: boolean | null;
}
export interface Extras {
  timeline: TimelineItem[];
  results: ResultItem[];
}

export interface Market {
  question: string;
  yes_prob: number;
  end_date: string | null;
}
export interface Regime {
  label: string;
  percentile: number;
}

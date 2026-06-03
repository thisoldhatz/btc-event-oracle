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

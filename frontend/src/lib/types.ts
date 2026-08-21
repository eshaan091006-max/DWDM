/**
 * TypeScript mirrors of the backend's JSON. These follow the live API, which is
 * the source of truth — not the plan document.
 */

export type AlgorithmKey = "dbscan" | "birch" | "cure";

export interface ParamSpec {
  name: string;
  label: string;
  type: "float" | "int" | "choice" | "bool";
  /** Optional numeric parameters (BIRCH n_clusters, CURE sample_size) default to null. */
  default: number | string | boolean | null;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  help: string;
}

export interface Theory {
  summary: string;
  how_it_works: string[];
  parameters: Record<string, string>;
  complexity: string;
  strengths: string[];
  weaknesses: string[];
}

export interface AlgorithmSpec {
  key: AlgorithmKey;
  label: string;
  tagline: string;
  params: ParamSpec[];
  theory: Theory;
}

export interface TraceStep {
  i: number;
  kind: string;
  narration: string;
  /** Keys are point indices serialised as strings by the backend's JSON layer. */
  labels_delta: Record<string, number>;
  payload: Record<string, unknown>;
  significant: boolean;
  /** Present only on keyframe steps; used to seek backwards without replaying from zero. */
  labels_snapshot: number[] | null;
}

export interface Trace {
  steps: TraceStep[];
  truncated: boolean;
  sample_rate: number;
}

export interface Metrics {
  /** Genuinely null when undefined (fewer than two clusters, or a singleton cluster). */
  silhouette: number | null;
  /** Null only when fewer than two clusters survive; singletons are fine for DB. */
  davies_bouldin: number | null;
  n_clusters: number;
  n_noise: number;
  cluster_sizes: Record<string, number>;
}

export interface ClusterResponse {
  algorithm: AlgorithmKey;
  labels: number[];
  n_clusters: number;
  n_noise: number;
  params_used: Record<string, unknown>;
  runtime_ms: number;
  metrics: Metrics;
  projection: {
    points_2d: number[][];
    /** Null when the data was already 2-D, so no projection actually happened. */
    explained_variance_ratio: number[] | null;
  };
  extras: Record<string, unknown>;
  trace: Trace;
}

export interface ParsedTable {
  columns: string[];
  dtypes: ("numeric" | "text")[];
  rows: (number | string | null)[][];
  n_rows: number;
  suggested_features: string[];
}

export interface GeneratorSpec {
  key: string;
  label: string;
  hint: string;
  supports_noise: boolean;
}

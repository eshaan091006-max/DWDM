/** A metric with no defined value renders as an em dash, never as 0 or NaN. */
export function formatMetric(value: number | null, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Display names for algorithm parameters, using the symbols the literature and
 * most course notes use, so what is on screen matches what a marker expects.
 */
const PARAM_LABELS: Record<string, string> = {
  eps: "ε",
  min_pts: "minPts",
  metric: "metric",
  threshold: "T",
  branching_factor: "B",
  n_clusters: "k",
  n_representatives: "c",
  shrink_factor: "α",
  sample_size: "sample",
  random_seed: "seed",
};

/**
 * The parameters a result was actually produced with, as one readable line.
 *
 * This reads `params_used` from the response — the values the backend really
 * ran with — not the slider state, which the user may have moved since. Showing
 * a live slider value next to a stale result would be actively misleading.
 */
export function formatParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      const label = PARAM_LABELS[key] ?? key;
      const shown = typeof value === "number" ? Number(value.toFixed(4)) : String(value);
      return `${label} = ${shown}`;
    })
    .join("  ·  ");
}

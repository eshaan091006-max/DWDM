/**
 * CURE's merge phase is O(n^3) in this implementation: reducing n singletons to
 * k clusters takes ~n merges, and each merge rescans every surviving pair.
 * Measured: 0.2s at n=60, 1.8s at n=120, 15s at n=200, 54s at n=300.
 *
 * Left unguarded, picking the default 300-point dataset and hitting run would
 * block the UI for the better part of a minute with nothing to show for it —
 * and in Compare mode, where CURE runs alongside the other two on a
 * single-threaded backend, considerably longer.
 *
 * Sampling is CURE's own answer to this, not a workaround: the original paper
 * clusters a random sample and labels the remainder by nearest representative.
 * So above a threshold we fill in `sample_size` — but the UI always says when
 * it has done so, because a result quietly computed on a subset is not the
 * result the user asked for.
 */
/*
 * The cap is lower in production because the deployed backend is a serverless
 * function with a hard execution limit, and CURE's cubic merge phase runs
 * straight into it. Measured on a 400-point input:
 *
 *   sample 100 -> 2.31 s      sample 120 -> 3.85 s      sample 150 -> 8.41 s
 *
 * Against Vercel's 10 s ceiling, 150 leaves 1.2x headroom on a machine faster
 * than the serverless CPU — it would time out. 100 leaves 4.3x, which survives
 * a cold start. Locally there is no such ceiling, so development keeps the
 * larger sample and the better clustering that comes with it.
 */
export const CURE_SAMPLE_THRESHOLD = import.meta.env.PROD ? 100 : 150;

export interface CureGuardResult {
  params: Record<string, unknown>;
  /** True when a sample size was filled in that the user did not choose. */
  applied: boolean;
  sampleSize: number | null;
}

export function guardCureParams(
  params: Record<string, unknown>,
  pointCount: number,
): CureGuardResult {
  const chosen = params.sample_size;
  // An explicit choice always wins, including a deliberately large one.
  if (chosen !== null && chosen !== undefined) {
    return { params, applied: false, sampleSize: Number(chosen) };
  }
  if (pointCount <= CURE_SAMPLE_THRESHOLD) {
    return { params, applied: false, sampleSize: null };
  }
  return {
    params: { ...params, sample_size: CURE_SAMPLE_THRESHOLD },
    applied: true,
    sampleSize: CURE_SAMPLE_THRESHOLD,
  };
}

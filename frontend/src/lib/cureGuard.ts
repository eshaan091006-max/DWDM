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
export const CURE_SAMPLE_THRESHOLD = 150;

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

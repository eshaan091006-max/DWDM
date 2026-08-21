import type { TraceStep } from "./types";

/**
 * The label assignment after replaying every step up to and including `upTo`.
 *
 * Replay starts from the nearest keyframe at or before the playhead rather than
 * from step zero, which is what keeps scrubbing backwards cheap on a long trace.
 */
export function labelsAt(steps: TraceStep[], upTo: number, pointCount: number): number[] {
  const labels = new Array<number>(pointCount).fill(-1);
  if (steps.length === 0 || upTo < 0) return labels;

  const end = Math.min(upTo, steps.length - 1);

  let start = 0;
  for (let i = end; i >= 0; i -= 1) {
    const snapshot = steps[i].labels_snapshot;
    if (snapshot) {
      for (let j = 0; j < pointCount; j += 1) labels[j] = snapshot[j] ?? -1;
      // The snapshot already includes step i's own delta, so resume after it.
      start = i + 1;
      break;
    }
  }

  for (let i = start; i <= end; i += 1) {
    const delta = steps[i].labels_delta;
    for (const key in delta) labels[Number(key)] = delta[key];
  }
  return labels;
}

/** The last `limit` narration lines ending at the playhead, oldest first. */
export function narrationLog(steps: TraceStep[], upTo: number, limit = 6): string[] {
  if (steps.length === 0 || upTo < 0) return [];
  const end = Math.min(upTo, steps.length - 1);
  return steps.slice(Math.max(0, end - limit + 1), end + 1).map((step) => step.narration);
}

import type { TraceStep } from "../../../lib/types";
import type { Overlay } from "../ScatterCanvas";

const NOOP: Overlay = () => {};
const REP = "#c86bd4";
const CENTROID = "#e0b23c";

/**
 * Draws a cluster's representative points, animating them along the path from
 * their scattered positions to their shrunken ones.
 *
 * `progress` runs 0 to 1 within a single shrink step, which is what makes the
 * shrink factor legible: you watch the representatives pull inward toward the
 * centroid rather than just seeing the end state.
 */
export function cureOverlay(
  step: TraceStep | null,
  _points: number[][],
  progress: number,
): Overlay {
  if (!step) return NOOP;

  const before = step.payload.reps_before as number[][] | undefined;
  const after = step.payload.reps_after as number[][] | undefined;
  const centroid = step.payload.centroid as number[] | undefined;

  // On a step that is not a shrink, fall back to whatever final representatives
  // the payload carries, so the picture never goes blank mid-playback.
  if (!before || !after || before.length !== after.length) {
    const finals = step.payload.representatives as Record<string, number[][]> | undefined;
    if (!finals) return NOOP;
    return (ctx, t) => {
      for (const reps of Object.values(finals)) {
        for (const rep of reps) {
          const [rx, ry] = t.toScreen(rep[0], rep[1] ?? 0);
          ctx.beginPath();
          ctx.arc(rx, ry, 6, 0, Math.PI * 2);
          ctx.strokeStyle = REP;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    };
  }

  const eased = Math.max(0, Math.min(1, progress));

  return (ctx, t) => {
    if (centroid) {
      const [cx, cy] = t.toScreen(centroid[0], centroid[1] ?? 0);
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = CENTROID;
      ctx.fill();

      for (let i = 0; i < before.length; i += 1) {
        const x = before[i][0] + (after[i][0] - before[i][0]) * eased;
        const y = (before[i][1] ?? 0) + ((after[i][1] ?? 0) - (before[i][1] ?? 0)) * eased;
        const [rx, ry] = t.toScreen(x, y);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = "rgba(200, 107, 212, 0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (let i = 0; i < before.length; i += 1) {
      const x = before[i][0] + (after[i][0] - before[i][0]) * eased;
      const y = (before[i][1] ?? 0) + ((after[i][1] ?? 0) - (before[i][1] ?? 0)) * eased;
      const [rx, ry] = t.toScreen(x, y);
      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, Math.PI * 2);
      ctx.strokeStyle = REP;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  };
}

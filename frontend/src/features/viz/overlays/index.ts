import type { AlgorithmKey, TraceStep } from "../../../lib/types";
import type { Overlay } from "../ScatterCanvas";
import { birchOverlay } from "./birch";
import { cureOverlay } from "./cure";
import { dbscanOverlay } from "./dbscan";

export { birchOverlay, cureOverlay, dbscanOverlay };

/** Pick the overlay matching the algorithm being animated. */
export function overlayFor(
  algorithm: AlgorithmKey,
  step: TraceStep | null,
  points: number[][],
  progress: number,
): Overlay {
  if (algorithm === "dbscan") return dbscanOverlay(step, points);
  if (algorithm === "birch") return birchOverlay(step, points);
  return cureOverlay(step, points, progress);
}

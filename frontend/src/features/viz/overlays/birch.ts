import type { TraceStep } from "../../../lib/types";
import type { Overlay } from "../ScatterCanvas";

const NOOP: Overlay = () => {};
const ENTRY = "#3fb99a";
const CURRENT = "#e8845f";

interface SerialisedEntry {
  n: number;
  centroid: number[];
  radius: number;
  child: number | null;
}
interface SerialisedNode {
  id: number;
  parent: number | null;
  is_leaf: boolean;
  entries: SerialisedEntry[];
}
interface SerialisedTree {
  root: number;
  nodes: SerialisedNode[];
}

/**
 * Draws every leaf clustering feature as a circle at its centroid with its true
 * radius, so the compression BIRCH performs is visible directly on the data.
 */
export function birchOverlay(step: TraceStep | null, points: number[][]): Overlay {
  if (!step) return NOOP;

  const tree = step.payload.tree as SerialisedTree | undefined;
  const currentPoint = step.payload.point as number | undefined;
  if (!tree?.nodes) return NOOP;

  const leafEntries = tree.nodes.filter((node) => node.is_leaf).flatMap((node) => node.entries);

  return (ctx, t) => {
    for (const entry of leafEntries) {
      const [cx, cy] = t.toScreen(entry.centroid[0], entry.centroid[1] ?? 0);
      // A single-point entry has radius 0; keep it visible anyway.
      const radius = Math.max(entry.radius * t.scale, 3);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(63, 185, 154, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = ENTRY;
      ctx.fill();
    }

    if (currentPoint !== undefined && points[currentPoint]) {
      const [px, py] = t.toScreen(points[currentPoint][0], points[currentPoint][1] ?? 0);
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = CURRENT;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  };
}

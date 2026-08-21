import type { TraceStep } from "../../../lib/types";
import type { Overlay } from "../ScatterCanvas";

const NOOP: Overlay = () => {};

// Literal colours, not var(--clay-*): a canvas context takes CSS colour VALUES
// and cannot resolve custom properties. Assigning one silently leaves the
// previous style in place, which is invisible until the drawing looks wrong.
const ACCENT = "#7c6cf0";
const QUEUE = "#e0b23c";

/**
 * Draws the eps-neighbourhood of the point DBSCAN is currently visiting, links
 * to every neighbour inside it, and the frontier queue still waiting.
 *
 * The circle's radius is `eps * t.scale` — a data-space distance scaled by the
 * transform — so what the user sees is literally the parameter they set.
 */
export function dbscanOverlay(step: TraceStep | null, points: number[][]): Overlay {
  if (!step) return NOOP;

  const circle = step.payload.eps_circle as { center: number[]; radius: number } | undefined;
  const neighbours = (step.payload.neighbors as number[] | undefined) ?? [];
  const queue = (step.payload.queue as number[] | undefined) ?? [];

  if (!circle) return NOOP;

  return (ctx, t) => {
    const [cx, cy] = t.toScreen(circle.center[0], circle.center[1] ?? 0);

    for (const index of queue) {
      const point = points[index];
      if (!point) continue;
      const [qx, qy] = t.toScreen(point[0], point[1] ?? 0);
      ctx.beginPath();
      ctx.arc(qx, qy, 7, 0, Math.PI * 2);
      ctx.strokeStyle = QUEUE;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(124, 108, 240, 0.45)";
    ctx.lineWidth = 1;
    for (const index of neighbours) {
      const point = points[index];
      if (!point) continue;
      const [nx, ny] = t.toScreen(point[0], point[1] ?? 0);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, circle.radius * t.scale, 0, Math.PI * 2);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
  };
}

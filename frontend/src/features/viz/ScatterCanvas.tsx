import { useEffect, useRef, useState } from "react";

import { NOISE_COLOR, clusterColor } from "../../lib/colors";
import { type Transform, makeTransform } from "./transform";

export type Overlay = (ctx: CanvasRenderingContext2D, t: Transform) => void;

const HIT_RADIUS = 10;
const PADDING = 34;

export function ScatterCanvas({
  points,
  labels,
  pointTypes,
  overlay,
  editable = false,
  onAddPoint,
  onMovePoint,
  onRemovePoint,
  height = 520,
  caption,
}: {
  points: number[][];
  labels: number[];
  pointTypes?: string[];
  overlay?: Overlay;
  editable?: boolean;
  onAddPoint?: (point: [number, number]) => void;
  onMovePoint?: (index: number, point: [number, number]) => void;
  onRemovePoint?: (index: number) => void;
  height?: number;
  /** Drawn into the canvas itself, so exported PNGs carry their parameters. */
  caption?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);
  const dragRef = useRef<number | null>(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Back the canvas at device resolution so points are not blurry on HiDPI.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const transform = makeTransform(points, width, height, PADDING);

    // Overlays draw underneath the points so they never hide the data.
    if (overlay) {
      ctx.save();
      overlay(ctx, transform);
      ctx.restore();
    }

    for (let i = 0; i < points.length; i += 1) {
      const [sx, sy] = transform.toScreen(points[i][0], points[i][1] ?? 0);
      const label = labels[i] ?? -1;
      const kind = pointTypes?.[i];

      ctx.beginPath();
      ctx.arc(sx, sy, label < 0 ? 3 : 4.5, 0, Math.PI * 2);

      if (label < 0) {
        // Noise stays hollow so it reads as excluded, not as another cluster.
        ctx.shadowBlur = 0;
        ctx.strokeStyle = NOISE_COLOR;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        const colour = clusterColor(label);
        // A short glow in the point's own hue. It makes clusters read as lit
        // rather than printed, and it reinforces cluster identity by colour
        // even where points overlap.
        ctx.shadowBlur = 10;
        ctx.shadowColor = colour;
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (kind === "core") {
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }
    }
    ctx.shadowBlur = 0;

    if (caption) {
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "top";
      const metrics = ctx.measureText(caption);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(10, 10, metrics.width + 14, 22);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(caption, 17, 15);
    }
  }, [points, labels, pointTypes, overlay, width, height, caption]);

  function locate(event: React.MouseEvent<HTMLCanvasElement>): {
    transform: Transform;
    sx: number;
    sy: number;
    hit: number | null;
  } {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const transform = makeTransform(points, width, height, PADDING);

    let hit: number | null = null;
    let best = HIT_RADIUS;
    for (let i = 0; i < points.length; i += 1) {
      const [px, py] = transform.toScreen(points[i][0], points[i][1] ?? 0);
      const distance = Math.hypot(px - sx, py - sy);
      if (distance < best) {
        best = distance;
        hit = i;
      }
    }
    return { transform, sx, sy, hit };
  }

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: "var(--clay-radius-lg)",
          background: "var(--clay-surface-sunken)",
          boxShadow: "var(--clay-shadow-sunken)",
          cursor: editable ? "crosshair" : "default",
          display: "block",
        }}
        onContextMenu={(event) => {
          if (!editable) return;
          event.preventDefault();
          const { hit } = locate(event);
          if (hit !== null) onRemovePoint?.(hit);
        }}
        onMouseDown={(event) => {
          if (!editable || event.button !== 0) return;
          const { hit } = locate(event);
          if (hit !== null && (event.altKey || event.metaKey)) {
            onRemovePoint?.(hit);
            return;
          }
          if (hit !== null) dragRef.current = hit;
        }}
        onMouseMove={(event) => {
          if (!editable || dragRef.current === null) return;
          const { transform, sx, sy } = locate(event);
          onMovePoint?.(dragRef.current, transform.toData(sx, sy));
        }}
        onMouseUp={(event) => {
          if (!editable) return;
          const wasDragging = dragRef.current !== null;
          dragRef.current = null;
          // A mouse-up that ended a drag must not also add a point.
          if (wasDragging) return;
          const { transform, sx, sy, hit } = locate(event);
          if (hit === null) onAddPoint?.(transform.toData(sx, sy));
        }}
        onMouseLeave={() => {
          dragRef.current = null;
        }}
      />
    </div>
  );
}

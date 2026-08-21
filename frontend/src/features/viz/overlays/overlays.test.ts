import { describe, expect, it, vi } from "vitest";

import type { TraceStep } from "../../../lib/types";
import { makeTransform } from "../transform";
import { birchOverlay, cureOverlay, dbscanOverlay, overlayFor } from ".";

function fakeContext() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

const points = [
  [0, 0],
  [1, 1],
  [2, 2],
];
const transform = makeTransform(points, 400, 400, 20);

function step(kind: string, payload: Record<string, unknown>): TraceStep {
  return {
    i: 0,
    kind,
    narration: "",
    labels_delta: {},
    payload,
    significant: false,
    labels_snapshot: null,
  };
}

const calls = (fn: unknown) => (fn as ReturnType<typeof vi.fn>).mock.calls;

describe("overlays", () => {
  it("all overlays no-op on a null step", () => {
    for (const overlay of [
      dbscanOverlay(null, points),
      birchOverlay(null, points),
      cureOverlay(null, points, 0),
    ]) {
      const ctx = fakeContext();
      overlay(ctx, transform);
      expect(ctx.arc).not.toHaveBeenCalled();
    }
  });

  it("dbscan draws the eps circle scaled by the transform, not in fixed pixels", () => {
    const ctx = fakeContext();
    dbscanOverlay(
      step("visit", { point: 0, eps_circle: { center: [0, 0], radius: 0.5 }, neighbors: [1] }),
      points,
    )(ctx, transform);
    const radii = calls(ctx.arc).map((c) => c[2]);
    expect(radii).toContain(0.5 * transform.scale);
  });

  it("dbscan links the current point to each neighbour", () => {
    const ctx = fakeContext();
    dbscanOverlay(
      step("visit", { point: 0, eps_circle: { center: [0, 0], radius: 0.5 }, neighbors: [1, 2] }),
      points,
    )(ctx, transform);
    expect(calls(ctx.lineTo).length).toBe(2);
  });

  it("dbscan uses literal colours, never CSS custom properties", () => {
    // A canvas context cannot resolve var(--x); assigning one silently keeps
    // the previous style, so this would fail invisibly at runtime.
    const ctx = fakeContext();
    const assigned: string[] = [];
    const probe = new Proxy(ctx, {
      set(target, prop, value) {
        if (prop === "strokeStyle" || prop === "fillStyle") assigned.push(String(value));
        return Reflect.set(target, prop, value);
      },
    });
    dbscanOverlay(
      step("visit", {
        point: 0,
        eps_circle: { center: [0, 0], radius: 0.5 },
        neighbors: [1],
        queue: [2],
      }),
      points,
    )(probe, transform);
    expect(assigned.length).toBeGreaterThan(0);
    for (const value of assigned) expect(value).not.toContain("var(");
  });

  it("dbscan tolerates a step with no eps circle", () => {
    const ctx = fakeContext();
    expect(() => dbscanOverlay(step("noise", { point: 1 }), points)(ctx, transform)).not.toThrow();
  });

  it("birch draws one circle per cf entry", () => {
    const ctx = fakeContext();
    birchOverlay(
      step("absorb", {
        tree: {
          root: 0,
          nodes: [
            {
              id: 0,
              parent: null,
              is_leaf: true,
              entries: [
                { n: 3, centroid: [0, 0], radius: 0.4, child: null },
                { n: 2, centroid: [2, 2], radius: 0.2, child: null },
              ],
            },
          ],
        },
      }),
      points,
    )(ctx, transform);
    // Two entry circles plus their two centre dots.
    expect(calls(ctx.arc).length).toBe(4);
  });

  it("birch scales entry radii through the transform", () => {
    const ctx = fakeContext();
    birchOverlay(
      step("absorb", {
        tree: {
          root: 0,
          nodes: [
            {
              id: 0,
              parent: null,
              is_leaf: true,
              entries: [{ n: 1, centroid: [0, 0], radius: 0.75, child: null }],
            },
          ],
        },
      }),
      points,
    )(ctx, transform);
    expect(calls(ctx.arc)[0][2]).toBeCloseTo(0.75 * transform.scale, 6);
  });

  it("birch keeps a zero-radius entry visible", () => {
    const ctx = fakeContext();
    birchOverlay(
      step("new_entry", {
        tree: {
          root: 0,
          nodes: [
            {
              id: 0,
              parent: null,
              is_leaf: true,
              entries: [{ n: 1, centroid: [0, 0], radius: 0, child: null }],
            },
          ],
        },
      }),
      points,
    )(ctx, transform);
    expect(calls(ctx.arc)[0][2]).toBeGreaterThan(0);
  });

  it("cure tweens representatives between before and after by progress", () => {
    const before = [[0, 0]];
    const after = [[2, 2]];
    const payload = { reps_before: before, reps_after: after, centroid: [1, 1] };

    const ctxStart = fakeContext();
    cureOverlay(step("shrink", payload), points, 0)(ctxStart, transform);
    const ctxEnd = fakeContext();
    cureOverlay(step("shrink", payload), points, 1)(ctxEnd, transform);

    // Last arc is the representative ring (the centroid dot is drawn first).
    const startX = calls(ctxStart.arc).at(-1)![0];
    const endX = calls(ctxEnd.arc).at(-1)![0];
    expect(startX).toBeCloseTo(transform.toScreen(0, 0)[0], 6);
    expect(endX).toBeCloseTo(transform.toScreen(2, 2)[0], 6);
  });

  it("cure clamps progress outside 0..1", () => {
    const payload = { reps_before: [[0, 0]], reps_after: [[2, 2]], centroid: [1, 1] };
    const ctx = fakeContext();
    cureOverlay(step("shrink", payload), points, 5)(ctx, transform);
    expect(calls(ctx.arc).at(-1)![0]).toBeCloseTo(transform.toScreen(2, 2)[0], 6);
  });

  it("cure falls back to final representatives on a non-shrink step", () => {
    const ctx = fakeContext();
    cureOverlay(step("done", { representatives: { "0": [[1, 1]] } }), points, 1)(ctx, transform);
    expect(calls(ctx.arc).length).toBe(1);
  });

  it("overlayFor dispatches by algorithm", () => {
    const ctx = fakeContext();
    overlayFor(
      "dbscan",
      step("visit", { point: 0, eps_circle: { center: [0, 0], radius: 0.5 }, neighbors: [] }),
      points,
      0,
    )(ctx, transform);
    expect(ctx.arc).toHaveBeenCalled();
  });
});

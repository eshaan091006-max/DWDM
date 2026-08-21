import { describe, expect, it } from "vitest";

import { makeTransform } from "./transform";

describe("makeTransform", () => {
  it("round-trips data through screen space", () => {
    const t = makeTransform(
      [
        [0, 0],
        [10, 10],
      ],
      400,
      400,
      20,
    );
    const [sx, sy] = t.toScreen(5, 5);
    const [x, y] = t.toData(sx, sy);
    expect(x).toBeCloseTo(5, 6);
    expect(y).toBeCloseTo(5, 6);
  });

  it("uses one scale for both axes so circles stay circular", () => {
    // If x and y scaled independently, DBSCAN's eps circle would render as an
    // ellipse and misrepresent the parameter.
    const t = makeTransform(
      [
        [0, 0],
        [10, 1],
      ],
      400,
      400,
      20,
    );
    const [x0] = t.toScreen(0, 0);
    const [x1] = t.toScreen(1, 0);
    const [, y0] = t.toScreen(0, 0);
    const [, y1] = t.toScreen(0, 1);
    expect(Math.abs(x1 - x0)).toBeCloseTo(Math.abs(y1 - y0), 6);
  });

  it("flips the y axis so larger values appear higher", () => {
    const t = makeTransform(
      [
        [0, 0],
        [10, 10],
      ],
      400,
      400,
      20,
    );
    const [, low] = t.toScreen(0, 0);
    const [, high] = t.toScreen(0, 10);
    expect(high).toBeLessThan(low);
  });

  it("keeps every point inside the padded box", () => {
    const points = [
      [-5, -5],
      [5, 5],
      [0, 3],
    ];
    const t = makeTransform(points, 300, 200, 15);
    for (const [x, y] of points) {
      const [sx, sy] = t.toScreen(x, y);
      expect(sx).toBeGreaterThanOrEqual(15 - 1e-6);
      expect(sx).toBeLessThanOrEqual(285 + 1e-6);
      expect(sy).toBeGreaterThanOrEqual(15 - 1e-6);
      expect(sy).toBeLessThanOrEqual(185 + 1e-6);
    }
  });

  it("handles a single point without NaN", () => {
    const t = makeTransform([[3, 4]], 400, 400, 20);
    const [sx, sy] = t.toScreen(3, 4);
    expect(Number.isFinite(sx)).toBe(true);
    expect(Number.isFinite(sy)).toBe(true);
  });

  it("handles identical points without NaN", () => {
    const t = makeTransform(
      [
        [2, 2],
        [2, 2],
        [2, 2],
      ],
      400,
      400,
      20,
    );
    const [sx, sy] = t.toScreen(2, 2);
    expect(Number.isFinite(sx)).toBe(true);
    expect(Number.isFinite(sy)).toBe(true);
    expect(t.scale).toBeGreaterThan(0);
  });

  it("handles an empty point set without NaN", () => {
    const t = makeTransform([], 400, 400, 20);
    const [sx, sy] = t.toScreen(0, 0);
    expect(Number.isFinite(sx)).toBe(true);
    expect(Number.isFinite(sy)).toBe(true);
  });

  it("exposes the scale so overlays can size radii in screen units", () => {
    const t = makeTransform(
      [
        [0, 0],
        [10, 10],
      ],
      420,
      420,
      10,
    );
    expect(t.scale).toBeCloseTo(40, 6);
  });

  it("round-trips a click back to the point it landed on", () => {
    // The canvas editor depends on this: a click at a point's screen position
    // must map back to (approximately) that point's data coordinates.
    const points = [
      [1.5, -2.25],
      [-4, 8],
    ];
    const t = makeTransform(points, 640, 480, 34);
    for (const [x, y] of points) {
      const [sx, sy] = t.toScreen(x, y);
      const [bx, by] = t.toData(sx, sy);
      expect(bx).toBeCloseTo(x, 6);
      expect(by).toBeCloseTo(y, 6);
    }
  });
});

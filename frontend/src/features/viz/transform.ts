export interface Transform {
  toScreen(x: number, y: number): [number, number];
  toData(sx: number, sy: number): [number, number];
  /** Screen pixels per data unit. Overlays use this to size radii. */
  scale: number;
}

/**
 * Build a transform that fits `points` into a padded box.
 *
 * Both axes share ONE scale. That is not cosmetic: DBSCAN's eps neighbourhood is
 * a circle in data space, and with independent x/y scales it would render as an
 * ellipse — the overlay would then be lying about what the algorithm did.
 */
export function makeTransform(
  points: number[][],
  width: number,
  height: number,
  padding = 24,
): Transform {
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    const x = point[0] ?? 0;
    const y = point[1] ?? 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // An empty point set leaves the bounds at Infinity; fall back to a unit window
  // so the transform still produces finite numbers.
  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minY = -1;
    maxY = 1;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // A single point, or many identical ones, gives a zero span. Guard the divide.
  const safeSpanX = spanX > 1e-12 ? spanX : 1;
  const safeSpanY = spanY > 1e-12 ? spanY : 1;

  const scale = Math.min(innerWidth / safeSpanX, innerHeight / safeSpanY);

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const originX = width / 2 - centreX * scale;
  // y is flipped: screen y grows downward, data y grows upward.
  const originY = height / 2 + centreY * scale;

  return {
    scale,
    toScreen(x, y) {
      return [originX + x * scale, originY - y * scale];
    },
    toData(sx, sy) {
      return [(sx - originX) / scale, (originY - sy) / scale];
    },
  };
}

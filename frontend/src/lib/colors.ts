/**
 * A categorical palette for cluster identity.
 *
 * Hues are spaced unevenly on purpose: the green-to-red region is thinned out,
 * because that is exactly where deuteranopia and protanopia collapse
 * distinctions. Every entry also holds its lightness roughly constant so the
 * set stays legible against both the light and dark clay surfaces.
 */
export const CLUSTER_PALETTE = [
  "#6c7ff2",
  "#e8845f",
  "#3fb99a",
  "#c86bd4",
  "#e0b23c",
  "#4aa5d8",
  "#e0648f",
  "#7fb542",
  "#9b7ae0",
  "#d97a3c",
  "#42bdc4",
  "#b5568c",
];

/** Noise is never a colour in the palette — it must not read as a 13th cluster. */
export const NOISE_COLOR = "#9298b8";

/** The fill colour for a label. Noise (-1) always renders grey. */
export function clusterColor(label: number): string {
  if (label < 0) return NOISE_COLOR;
  return CLUSTER_PALETTE[label % CLUSTER_PALETTE.length];
}

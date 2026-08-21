import type { ClusterResponse } from "./types";

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The original features plus the assigned cluster and an explicit noise flag. */
export function toLabelledCsv(
  points: number[][],
  featureNames: string[],
  labels: number[],
): string {
  const header = [...featureNames.map(csvCell), "cluster", "is_noise"].join(",");
  const rows = points.map((point, index) => {
    const label = labels[index] ?? -1;
    return [...point.map(csvCell), label, label < 0].join(",");
  });
  return [header, ...rows].join("\n") + "\n";
}

/** A compact JSON summary of one run, small enough to paste into a writeup. */
export function toRunReport(
  result: ClusterResponse,
  datasetName: string,
  pointCount: number,
): string {
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      dataset: { name: datasetName, n_points: pointCount },
      algorithm: result.algorithm,
      parameters: result.params_used,
      runtime_ms: result.runtime_ms,
      n_clusters: result.n_clusters,
      n_noise: result.n_noise,
      metrics: result.metrics,
      projection_explained_variance: result.projection.explained_variance_ratio,
      // The trace is deliberately excluded: it can run to megabytes and is
      // useless in a written report.
    },
    null,
    2,
  );
}

export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

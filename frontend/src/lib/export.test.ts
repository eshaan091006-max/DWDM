import { describe, expect, it } from "vitest";

import { toLabelledCsv, toRunReport } from "./export";
import type { ClusterResponse } from "./types";

describe("toLabelledCsv", () => {
  it("writes a header from the feature names plus cluster and noise", () => {
    const csv = toLabelledCsv([[1, 2]], ["x", "y"], [0]);
    expect(csv.split("\n")[0]).toBe("x,y,cluster,is_noise");
  });

  it("writes one row per point", () => {
    const csv = toLabelledCsv(
      [
        [1, 2],
        [3, 4],
      ],
      ["x", "y"],
      [0, 1],
    );
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("1,2,0,false");
  });

  it("marks noise points", () => {
    const csv = toLabelledCsv([[1, 2]], ["x", "y"], [-1]);
    expect(csv.trim().split("\n")[1]).toBe("1,2,-1,true");
  });

  it("quotes feature names containing a comma", () => {
    const csv = toLabelledCsv([[1]], ["a,b"], [0]);
    expect(csv.split("\n")[0]).toBe('"a,b",cluster,is_noise');
  });

  it("escapes embedded quotes by doubling them", () => {
    const csv = toLabelledCsv([[1]], ['say "hi"'], [0]);
    expect(csv.split("\n")[0]).toBe('"say ""hi""",cluster,is_noise');
  });

  it("handles an empty point set by emitting only a header", () => {
    expect(toLabelledCsv([], ["x"], []).trim()).toBe("x,cluster,is_noise");
  });

  it("falls back to -1 when a label is missing", () => {
    const csv = toLabelledCsv([[1]], ["x"], []);
    expect(csv.trim().split("\n")[1]).toBe("1,-1,true");
  });

  it("writes every feature of a high-dimensional point", () => {
    const csv = toLabelledCsv([[1, 2, 3, 4]], ["a", "b", "c", "d"], [2]);
    expect(csv.trim().split("\n")[1]).toBe("1,2,3,4,2,false");
  });
});

describe("toRunReport", () => {
  const result = {
    algorithm: "dbscan",
    labels: [0, 0, -1],
    n_clusters: 1,
    n_noise: 1,
    params_used: { eps: 0.5, min_pts: 5 },
    runtime_ms: 12.5,
    metrics: {
      silhouette: 0.6,
      davies_bouldin: 0.7,
      n_clusters: 1,
      n_noise: 1,
      cluster_sizes: { "0": 2 },
    },
    projection: { points_2d: [], explained_variance_ratio: null },
    extras: {},
    trace: { steps: [{ i: 0 }], truncated: false, sample_rate: 1 },
  } as unknown as ClusterResponse;

  it("records the algorithm, parameters, and metrics", () => {
    const report = JSON.parse(toRunReport(result, "blobs", 3));
    expect(report.algorithm).toBe("dbscan");
    expect(report.parameters).toEqual({ eps: 0.5, min_pts: 5 });
    expect(report.metrics.silhouette).toBe(0.6);
    expect(report.dataset.name).toBe("blobs");
    expect(report.dataset.n_points).toBe(3);
  });

  it("omits the trace, which is far too large for a report", () => {
    const report = JSON.parse(toRunReport(result, "blobs", 3));
    expect(report.trace).toBeUndefined();
  });

  it("includes a timestamp", () => {
    const report = JSON.parse(toRunReport(result, "blobs", 3));
    expect(typeof report.generated_at).toBe("string");
    expect(Number.isNaN(Date.parse(report.generated_at))).toBe(false);
  });

  it("produces valid JSON", () => {
    expect(() => JSON.parse(toRunReport(result, "blobs", 3))).not.toThrow();
  });
});

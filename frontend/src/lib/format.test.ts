import { describe, expect, it } from "vitest";

import { formatMetric, formatMs, formatParams, formatPercent } from "./format";

describe("formatMetric", () => {
  it("renders an em dash for null", () => {
    expect(formatMetric(null)).toBe("—");
  });

  it("rounds to three digits by default", () => {
    expect(formatMetric(0.612345)).toBe("0.612");
  });

  it("respects a custom digit count", () => {
    expect(formatMetric(0.612345, 1)).toBe("0.6");
  });

  it("keeps the sign on negative scores", () => {
    expect(formatMetric(-0.25)).toBe("-0.250");
  });

  it("renders an em dash for NaN rather than the text NaN", () => {
    expect(formatMetric(Number.NaN)).toBe("—");
  });
});

describe("formatMs", () => {
  it("uses milliseconds below a second", () => {
    expect(formatMs(41.2)).toBe("41 ms");
  });

  it("switches to seconds at and above 1000ms", () => {
    expect(formatMs(1250)).toBe("1.25 s");
  });

  it("handles zero", () => {
    expect(formatMs(0)).toBe("0 ms");
  });
});

describe("formatPercent", () => {
  it("renders a fraction as a percentage", () => {
    expect(formatPercent(0.723)).toBe("72%");
  });
});

describe("formatParams", () => {
  it("renders DBSCAN parameters with their conventional symbols", () => {
    expect(formatParams({ eps: 0.5, min_pts: 5 })).toBe("ε = 0.5  ·  minPts = 5");
  });

  it("renders BIRCH parameters", () => {
    expect(formatParams({ threshold: 0.5, branching_factor: 50, n_clusters: 3 })).toBe(
      "T = 0.5  ·  B = 50  ·  k = 3",
    );
  });

  it("renders CURE parameters", () => {
    expect(formatParams({ n_clusters: 3, n_representatives: 5, shrink_factor: 0.2 })).toBe(
      "k = 3  ·  c = 5  ·  α = 0.2",
    );
  });

  it("omits parameters that were left unset", () => {
    expect(formatParams({ threshold: 0.5, n_clusters: null })).toBe("T = 0.5");
  });

  it("keeps string parameters as-is", () => {
    expect(formatParams({ metric: "manhattan" })).toBe("metric = manhattan");
  });

  it("falls back to the raw key for an unknown parameter", () => {
    expect(formatParams({ mystery: 7 })).toBe("mystery = 7");
  });

  it("renders an empty string for no parameters", () => {
    expect(formatParams({})).toBe("");
  });

  it("trims trailing zeros rather than padding", () => {
    expect(formatParams({ eps: 0.3 })).toBe("ε = 0.3");
  });
});

import { describe, expect, it } from "vitest";

import { CURE_SAMPLE_THRESHOLD, guardCureParams } from "./cureGuard";

describe("guardCureParams", () => {
  it("leaves small datasets alone", () => {
    const params = { n_clusters: 3, sample_size: null };
    const result = guardCureParams(params, 100);
    expect(result.applied).toBe(false);
    expect(result.params.sample_size).toBeNull();
  });

  it("does not fill in a sample at exactly the threshold", () => {
    expect(guardCureParams({ sample_size: null }, CURE_SAMPLE_THRESHOLD).applied).toBe(false);
  });

  it("fills in a sample size above the threshold", () => {
    const result = guardCureParams({ n_clusters: 3, sample_size: null }, 300);
    expect(result.applied).toBe(true);
    expect(result.params.sample_size).toBe(CURE_SAMPLE_THRESHOLD);
    expect(result.sampleSize).toBe(CURE_SAMPLE_THRESHOLD);
  });

  it("never overrides a sample size the user chose", () => {
    const result = guardCureParams({ sample_size: 500 }, 5000);
    expect(result.applied).toBe(false);
    expect(result.params.sample_size).toBe(500);
  });

  it("respects an explicit choice even when it is smaller than the threshold", () => {
    const result = guardCureParams({ sample_size: 40 }, 5000);
    expect(result.applied).toBe(false);
    expect(result.params.sample_size).toBe(40);
  });

  it("does not mutate the params it was given", () => {
    const params = { n_clusters: 3, sample_size: null };
    guardCureParams(params, 300);
    expect(params.sample_size).toBeNull();
  });

  it("preserves every other parameter", () => {
    const result = guardCureParams(
      { n_clusters: 4, n_representatives: 8, shrink_factor: 0.3, sample_size: null },
      400,
    );
    expect(result.params).toMatchObject({
      n_clusters: 4,
      n_representatives: 8,
      shrink_factor: 0.3,
    });
  });
});

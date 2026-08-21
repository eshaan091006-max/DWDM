import { describe, expect, it } from "vitest";

import { labelsAt, narrationLog } from "./trace";
import type { TraceStep } from "./types";

function step(
  i: number,
  delta: Record<string, number>,
  snapshot: number[] | null = null,
): TraceStep {
  return {
    i,
    kind: "assign",
    narration: `step ${i}`,
    labels_delta: delta,
    payload: {},
    significant: false,
    labels_snapshot: snapshot,
  };
}

describe("labelsAt", () => {
  it("returns all unassigned before the first step", () => {
    expect(labelsAt([step(0, { "0": 1 })], -1, 3)).toEqual([-1, -1, -1]);
  });

  it("accumulates deltas up to and including the playhead", () => {
    const steps = [step(0, { "0": 0 }), step(1, { "1": 1 }), step(2, { "2": 0 })];
    expect(labelsAt(steps, 1, 3)).toEqual([0, 1, -1]);
    expect(labelsAt(steps, 2, 3)).toEqual([0, 1, 0]);
  });

  it("lets a later delta overwrite an earlier one", () => {
    const steps = [step(0, { "0": 0 }), step(1, { "0": 5 })];
    expect(labelsAt(steps, 1, 1)).toEqual([5]);
  });

  it("seeks backwards using the nearest keyframe", () => {
    const steps = [
      step(0, { "0": 0 }, [0, -1, -1]),
      step(1, { "1": 1 }),
      step(2, { "2": 2 }, [0, 1, 2]),
      step(3, { "0": 9 }),
    ];
    expect(labelsAt(steps, 2, 3)).toEqual([0, 1, 2]);
    expect(labelsAt(steps, 3, 3)).toEqual([9, 1, 2]);
  });

  it("a keyframe read is identical to a full replay to the same index", () => {
    // The optimisation must not change the answer, only the work done.
    const withKeys: TraceStep[] = [];
    const withoutKeys: TraceStep[] = [];
    for (let i = 0; i < 40; i += 1) {
      const delta = { [String(i % 8)]: i % 3 };
      withKeys.push(step(i, delta, i % 10 === 0 ? null : null));
      withoutKeys.push(step(i, delta));
    }
    // Rebuild with real snapshots on every 10th step.
    let acc = new Array<number>(8).fill(-1);
    for (let i = 0; i < 40; i += 1) {
      for (const k in withKeys[i].labels_delta) acc[Number(k)] = withKeys[i].labels_delta[k];
      if (i % 10 === 0) withKeys[i].labels_snapshot = [...acc];
    }
    for (let probe = 0; probe < 40; probe += 1) {
      expect(labelsAt(withKeys, probe, 8)).toEqual(labelsAt(withoutKeys, probe, 8));
    }
  });

  it("clamps a playhead past the end to the final state", () => {
    const steps = [step(0, { "0": 0 }), step(1, { "1": 1 })];
    expect(labelsAt(steps, 99, 2)).toEqual([0, 1]);
  });

  it("returns unassigned labels for an empty trace", () => {
    expect(labelsAt([], 5, 2)).toEqual([-1, -1]);
  });
});

describe("narrationLog", () => {
  it("returns the most recent lines ending at the playhead", () => {
    const steps = [step(0, {}), step(1, {}), step(2, {}), step(3, {})];
    expect(narrationLog(steps, 3, 2)).toEqual(["step 2", "step 3"]);
  });

  it("is empty before the trace starts", () => {
    expect(narrationLog([step(0, {})], -1)).toEqual([]);
  });
});

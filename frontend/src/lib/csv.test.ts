import { describe, expect, it } from "vitest";

import { numericColumns, selectFeatures } from "./csv";
import type { ParsedTable } from "./types";

const table: ParsedTable = {
  columns: ["x", "y", "name", "cls"],
  dtypes: ["numeric", "numeric", "text", "numeric"],
  rows: [
    [1, 2, "a", 0],
    [3, 4, "b", 1],
    [5, null, "c", 0],
  ],
  n_rows: 3,
  suggested_features: ["x", "y"],
};

describe("selectFeatures", () => {
  it("extracts the chosen feature columns in the order given", () => {
    const result = selectFeatures(table, ["y", "x"], null);
    expect(result.points).toEqual([
      [2, 1],
      [4, 3],
    ]);
    expect(result.featureNames).toEqual(["y", "x"]);
  });

  it("drops rows with a missing value and reports the count", () => {
    const result = selectFeatures(table, ["x", "y"], null);
    expect(result.points).toHaveLength(2);
    expect(result.droppedRows).toBe(1);
  });

  it("keeps a row whose missing value is in an unselected column", () => {
    const result = selectFeatures(table, ["x"], null);
    expect(result.points).toHaveLength(3);
    expect(result.droppedRows).toBe(0);
  });

  it("extracts a label column alongside the features", () => {
    const result = selectFeatures(table, ["x", "y"], "cls");
    expect(result.labels).toEqual([0, 1]);
  });

  it("returns null labels when no label column is chosen", () => {
    expect(selectFeatures(table, ["x", "y"], null).labels).toBeNull();
  });

  it("maps non-numeric label values to distinct integers", () => {
    const result = selectFeatures(table, ["x"], "name");
    expect(result.labels).toEqual([0, 1, 2]);
  });

  it("gives repeated label values the same integer", () => {
    const repeated: ParsedTable = {
      columns: ["x", "g"],
      dtypes: ["numeric", "text"],
      rows: [
        [1, "a"],
        [2, "b"],
        [3, "a"],
      ],
      n_rows: 3,
      suggested_features: ["x"],
    };
    expect(selectFeatures(repeated, ["x"], "g").labels).toEqual([0, 1, 0]);
  });

  it("throws when no feature column is selected", () => {
    expect(() => selectFeatures(table, [], null)).toThrow();
  });

  it("throws when a selected column does not exist", () => {
    expect(() => selectFeatures(table, ["nope"], null)).toThrow();
  });

  it("throws when a selected feature column is not numeric", () => {
    expect(() => selectFeatures(table, ["name"], null)).toThrow(/numeric/i);
  });

  it("throws when every row would be dropped", () => {
    const allMissing: ParsedTable = {
      columns: ["x"],
      dtypes: ["numeric"],
      rows: [[null], [null]],
      n_rows: 2,
      suggested_features: ["x"],
    };
    expect(() => selectFeatures(allMissing, ["x"], null)).toThrow();
  });
});

describe("numericColumns", () => {
  it("lists only numeric columns", () => {
    expect(numericColumns(table)).toEqual(["x", "y", "cls"]);
  });
});

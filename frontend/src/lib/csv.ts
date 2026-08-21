import type { ParsedTable } from "./types";

export interface SelectionResult {
  points: number[][];
  labels: number[] | null;
  /**
   * The label column's raw values, kept as written, one per surviving point.
   *
   * `labels` turns these into integers so ground truth can be compared against
   * a clustering; `names` keeps the originals so the plot can print "A" beside
   * a point instead of "0". Both come from the same column and stay aligned.
   */
  names: string[] | null;
  droppedRows: number;
  featureNames: string[];
}

/** The names of every column the backend inferred as numeric. */
export function numericColumns(table: ParsedTable): string[] {
  return table.columns.filter((_, index) => table.dtypes[index] === "numeric");
}

/**
 * Project a parsed table onto the chosen feature columns.
 *
 * Rows missing a value in any selected feature are dropped and counted, so the
 * UI can tell the user how much data it discarded rather than hiding it.
 */
export function selectFeatures(
  table: ParsedTable,
  featureColumns: string[],
  labelColumn: string | null,
): SelectionResult {
  if (featureColumns.length === 0) {
    throw new Error("Select at least one feature column.");
  }

  const indices = featureColumns.map((name) => {
    const index = table.columns.indexOf(name);
    if (index === -1) throw new Error(`There is no column named "${name}".`);
    if (table.dtypes[index] !== "numeric") {
      throw new Error(`Column "${name}" is not numeric, so it cannot be a feature.`);
    }
    return index;
  });

  const labelIndex = labelColumn === null ? -1 : table.columns.indexOf(labelColumn);
  if (labelColumn !== null && labelIndex === -1) {
    throw new Error(`There is no column named "${labelColumn}".`);
  }

  const points: number[][] = [];
  const rawLabels: (number | string)[] = [];
  let droppedRows = 0;

  for (const row of table.rows) {
    const values = indices.map((index) => row[index]);
    const usable = values.every(
      (value) => value !== null && typeof value === "number" && Number.isFinite(value),
    );
    if (!usable) {
      droppedRows += 1;
      continue;
    }
    points.push(values as number[]);
    if (labelIndex !== -1) {
      const value = row[labelIndex];
      rawLabels.push(value === null ? "" : (value as number | string));
    }
  }

  if (points.length === 0) {
    throw new Error("Every row was dropped — the selected columns have no usable numbers.");
  }

  let labels: number[] | null = null;
  let names: string[] | null = null;
  if (labelIndex !== -1) {
    names = rawLabels.map((value) => String(value));
    // Non-numeric labels become stable integers by order of first appearance.
    const seen = new Map<string, number>();
    labels = names.map((key) => {
      if (!seen.has(key)) seen.set(key, seen.size);
      return seen.get(key)!;
    });
  }

  return { points, labels, names, droppedRows, featureNames: featureColumns };
}

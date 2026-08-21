import { useRef, useState } from "react";

import { ClayBadge, ClayButton } from "../../clay";
import { api } from "../../lib/api";
import { numericColumns, selectFeatures } from "../../lib/csv";
import type { ParsedTable } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

export function FileImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [labelColumn, setLabelColumn] = useState<string | null>(null);
  const [dropped, setDropped] = useState<number | null>(null);
  const [name, setName] = useState("");

  const setPoints = useAppStore((s) => s.setPoints);
  const setError = useAppStore((s) => s.setError);
  const setBusy = useAppStore((s) => s.setBusy);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const parsed = await api.upload(file);
      setTable(parsed);
      setFeatures(parsed.suggested_features);
      setLabelColumn(null);
      setDropped(null);
      setName(file.name);
      setError(null);
    } catch (error) {
      setError((error as Error).message);
      setTable(null);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!table) return;
    try {
      const result = selectFeatures(table, features, labelColumn);
      setPoints(result.points, result.featureNames, result.labels, name);
      setDropped(result.droppedRows);
      setError(null);
    } catch (error) {
      setError((error as Error).message);
    }
  }

  function toggleFeature(column: string) {
    setFeatures((current) =>
      current.includes(column) ? current.filter((c) => c !== column) : [...current, column],
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <ClayButton variant="primary" onClick={() => inputRef.current?.click()}>
        Choose a CSV or JSON file
      </ClayButton>

      {table && (
        <div className="mt-4">
          <p className="text-xs mb-2" style={{ color: "var(--clay-text-muted)" }}>
            {table.n_rows} rows · pick the feature columns (the order you click them is the
            order they are used)
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {numericColumns(table).map((column) => (
              <ClayButton
                key={column}
                size="sm"
                active={features.includes(column)}
                variant={features.includes(column) ? "primary" : "ghost"}
                onClick={() => toggleFeature(column)}
              >
                {column}
                {features.includes(column) ? ` (${features.indexOf(column) + 1})` : ""}
              </ClayButton>
            ))}
          </div>

          <p className="text-xs mb-2" style={{ color: "var(--clay-text-muted)" }}>
            Ground-truth label column (optional; never fed to the algorithms)
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <ClayButton size="sm" active={labelColumn === null} onClick={() => setLabelColumn(null)}>
              none
            </ClayButton>
            {table.columns.map((column) => (
              <ClayButton
                key={column}
                size="sm"
                active={labelColumn === column}
                onClick={() => setLabelColumn(column)}
              >
                {column}
              </ClayButton>
            ))}
          </div>

          <ClayButton variant="primary" onClick={apply} disabled={features.length === 0}>
            Use these columns
          </ClayButton>

          {dropped !== null && dropped > 0 && (
            <p className="mt-3">
              <ClayBadge tone="warn">
                {dropped} row{dropped === 1 ? "" : "s"} dropped for missing values
              </ClayBadge>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

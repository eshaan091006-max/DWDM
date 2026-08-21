import { useState } from "react";

import { ClayBadge, ClayButton, ClayCard } from "../../clay";
import { api } from "../../lib/api";
import { formatMetric, formatMs, formatParams } from "../../lib/format";
import type { AlgorithmKey, ClusterResponse } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { ScatterCanvas } from "../viz/ScatterCanvas";

const ORDER: AlgorithmKey[] = ["dbscan", "birch", "cure"];

export function CompareGrid() {
  const points = useAppStore((s) => s.points);
  const params = useAppStore((s) => s.params);
  const standardize = useAppStore((s) => s.standardize);
  const compareResults = useAppStore((s) => s.compareResults);
  const setCompareResults = useAppStore((s) => s.setCompareResults);
  const setError = useAppStore((s) => s.setError);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (points.length === 0) {
      setError("Load or generate some data first.");
      return;
    }
    setBusy(true);
    try {
      const results = await api.compare({
        points,
        configs: { dbscan: params.dbscan, birch: params.birch, cure: params.cure },
        standardize,
      });
      setCompareResults(results);
      setError(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <ClayButton variant="primary" onClick={run} disabled={busy || points.length === 0}>
          {busy ? "Running all three…" : "Run all three"}
        </ClayButton>
        <span className="text-xs" style={{ color: "var(--clay-text-muted)" }}>
          Same data and the same parameters as the single-algorithm tabs. No animation here —
          this view is for comparing outcomes.
        </span>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        {ORDER.map((key) => {
          const result: ClusterResponse | undefined = compareResults?.[key];
          return (
            <ClayCard key={key} title={key.toUpperCase()}>
              {result ? (
                <>
                  <ScatterCanvas
                    points={result.projection.points_2d}
                    labels={result.labels}
                    pointTypes={result.extras.point_types as string[] | undefined}
                    height={260}
                    caption={formatParams(result.params_used)}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <ClayBadge tone="accent">{result.n_clusters} clusters</ClayBadge>
                    {result.n_noise > 0 && <ClayBadge>{result.n_noise} noise</ClayBadge>}
                    <ClayBadge>sil {formatMetric(result.metrics.silhouette, 2)}</ClayBadge>
                    <ClayBadge>db {formatMetric(result.metrics.davies_bouldin, 2)}</ClayBadge>
                    <ClayBadge>{formatMs(result.runtime_ms)}</ClayBadge>
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
                  Not run yet.
                </p>
              )}
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
}

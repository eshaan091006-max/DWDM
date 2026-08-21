import { ClayBadge, ClayCard } from "../../clay";
import { clusterColor } from "../../lib/colors";
import { formatMetric, formatMs, formatParams, formatPercent } from "../../lib/format";
import type { ClusterResponse } from "../../lib/types";

const SILHOUETTE_UNDEFINED =
  "Undefined here: silhouette needs at least two clusters, each with at least two members.";
const DB_UNDEFINED = "Undefined here: Davies-Bouldin needs at least two clusters.";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="px-3 py-2.5"
      title={hint}
      style={{
        background: "var(--clay-surface-sunken)",
        borderRadius: "var(--clay-radius-sm)",
        boxShadow: "var(--clay-shadow-sunken)",
      }}
    >
      <div
        className="text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--clay-text-faint)" }}
      >
        {label}
      </div>
      <div className="text-lg font-bold font-mono mt-0.5" style={{ color: "var(--clay-text)" }}>
        {value}
      </div>
    </div>
  );
}

export function MetricsPanel({ result }: { result: ClusterResponse | null }) {
  if (!result) {
    return (
      <ClayCard title="Quality">
        <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
          Run an algorithm to see how well it separated the data.
        </p>
      </ClayCard>
    );
  }

  const { metrics } = result;
  const total = result.labels.length;
  const variance = result.projection.explained_variance_ratio;

  return (
    <ClayCard
      title="Quality"
      subtitle={`${result.algorithm.toUpperCase()} · ${formatMs(result.runtime_ms)}`}
    >
      {/* The parameters this result was actually produced with — read from
          params_used, not the sliders, which the user may have since moved. */}
      <div
        className="px-3 py-2 mb-4"
        style={{ background: "var(--clay-accent-soft)", borderRadius: "var(--clay-radius-sm)" }}
      >
        <div
          className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
          style={{ color: "var(--clay-text-faint)" }}
        >
          Parameters used
        </div>
        <div className="text-xs font-mono font-bold" style={{ color: "var(--clay-accent)" }}>
          {formatParams(result.params_used) || "defaults"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat label="Clusters" value={String(metrics.n_clusters)} />
        <Stat
          label="Noise"
          value={total > 0 ? formatPercent(metrics.n_noise / total) : "—"}
          hint={`${metrics.n_noise} of ${total} points left unassigned`}
        />
        <Stat
          label="Silhouette"
          value={formatMetric(metrics.silhouette)}
          hint={
            metrics.silhouette === null
              ? SILHOUETTE_UNDEFINED
              : "Higher is better; ranges -1 to 1."
          }
        />
        <Stat
          label="Davies-Bouldin"
          value={formatMetric(metrics.davies_bouldin)}
          hint={
            metrics.davies_bouldin === null ? DB_UNDEFINED : "Lower is better; 0 is ideal."
          }
        />
      </div>

      <div
        className="mb-1 text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--clay-text-faint)" }}
      >
        Cluster sizes
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(metrics.cluster_sizes).map(([id, size]) => (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold"
            style={{
              background: "var(--clay-surface-raised)",
              borderRadius: "999px",
              boxShadow: "var(--clay-shadow)",
              color: "var(--clay-text)",
            }}
          >
            <span
              className="inline-block w-2.5 h-2.5"
              style={{ background: clusterColor(Number(id)), borderRadius: "999px" }}
            />
            {size}
          </span>
        ))}
        {metrics.n_noise > 0 && <ClayBadge tone="neutral">{metrics.n_noise} noise</ClayBadge>}
      </div>

      {variance && (
        <p className="mt-4 text-[11px] leading-snug" style={{ color: "var(--clay-text-muted)" }}>
          The plot is a PCA projection showing {formatPercent(variance[0] + variance[1])} of the
          total variance. Clustering itself ran on all original dimensions.
        </p>
      )}
    </ClayCard>
  );
}

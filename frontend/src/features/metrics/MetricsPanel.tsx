import { ClayBadge, ClayCard, useCountUp } from "../../clay";
import { clusterColor } from "../../lib/colors";
import { formatMs, formatParams, formatPercent } from "../../lib/format";
import type { ClusterResponse } from "../../lib/types";

const SILHOUETTE_UNDEFINED =
  "Undefined here: silhouette needs at least two clusters, each with at least two members.";
const DB_UNDEFINED = "Undefined here: Davies-Bouldin needs at least two clusters.";

/**
 * A stat whose numeral rolls to its new value.
 *
 * `digits` and `suffix` keep the formatting identical to the static version, so
 * the animation is the only difference — the final rendered string matches what
 * `formatMetric` / `formatPercent` would have produced.
 */
function AnimatedStat({
  label,
  value,
  digits,
  suffix = "",
  hint,
}: {
  label: string;
  value: number | null;
  digits: number;
  suffix?: string;
  hint?: string;
}) {
  const animated = useCountUp(value);
  const shown =
    value === null || animated === null
      ? "—"
      : `${animated.toFixed(digits)}${suffix}`;
  return <Stat label={label} value={shown} hint={hint} />;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="px-3 py-2.5 clay-extrude"
      title={hint}
      style={{
        background: "var(--clay-surface-raised)",
        borderRadius: "var(--clay-radius-sm)",
      }}
    >
      <div
        className="text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--clay-text-faint)" }}
      >
        {label}
      </div>
      <div
        className="text-xl font-black font-mono mt-0.5 tracking-tight"
        style={{ color: "var(--clay-text)" }}
      >
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
        <AnimatedStat label="Clusters" value={metrics.n_clusters} digits={0} />
        <AnimatedStat
          label="Noise"
          value={total > 0 ? (metrics.n_noise / total) * 100 : null}
          digits={0}
          suffix="%"
          hint={`${metrics.n_noise} of ${total} points left unassigned`}
        />
        <AnimatedStat
          label="Silhouette"
          value={metrics.silhouette}
          digits={3}
          hint={
            metrics.silhouette === null
              ? SILHOUETTE_UNDEFINED
              : "Higher is better; ranges -1 to 1."
          }
        />
        <AnimatedStat
          label="Davies-Bouldin"
          value={metrics.davies_bouldin}
          digits={3}
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

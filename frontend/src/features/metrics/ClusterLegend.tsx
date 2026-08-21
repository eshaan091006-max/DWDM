import { NOISE_COLOR, clusterColor } from "../../lib/colors";
import type { ClusterResponse } from "../../lib/types";

/**
 * What each colour on the plot means.
 *
 * Without this the scatter is a field of unexplained hues — fine for the person
 * who set the parameters, useless to anyone watching over their shoulder. For
 * DBSCAN it also breaks out core / border / noise, which is the distinction the
 * algorithm is actually about and which colour alone cannot carry.
 */
export function ClusterLegend({
  result,
  compact = false,
}: {
  result: ClusterResponse | null;
  compact?: boolean;
}) {
  if (!result) return null;

  const sizes = Object.entries(result.metrics.cluster_sizes).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  const types = result.extras.point_types as string[] | undefined;
  const counts = types
    ? types.reduce<Record<string, number>>((acc, t) => {
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {})
    : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {sizes.map(([id, size]) => (
        <span key={id} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block"
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              background: clusterColor(Number(id)),
              boxShadow: `0 0 8px ${clusterColor(Number(id))}`,
            }}
          />
          <span
            className={`${compact ? "text-[11px]" : "text-xs"} font-bold`}
            style={{ color: "var(--clay-text)" }}
          >
            Cluster {id}
          </span>
          <span
            className={`${compact ? "text-[11px]" : "text-xs"} tabular-nums`}
            style={{ color: "var(--clay-text-muted)" }}
          >
            {size}
          </span>
        </span>
      ))}

      {result.n_noise > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block"
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              // Hollow, exactly as noise renders on the plot.
              border: `1.5px solid ${NOISE_COLOR}`,
            }}
          />
          <span
            className={`${compact ? "text-[11px]" : "text-xs"} font-bold`}
            style={{ color: "var(--clay-text-muted)" }}
          >
            Noise
          </span>
          <span
            className={`${compact ? "text-[11px]" : "text-xs"} tabular-nums`}
            style={{ color: "var(--clay-text-muted)" }}
          >
            {result.n_noise}
          </span>
        </span>
      )}

      {counts && (
        <span
          className={`${compact ? "text-[11px]" : "text-xs"} tabular-nums`}
          style={{ color: "var(--clay-text-faint)" }}
          title="DBSCAN classifies every point as core, border, or noise. Core points have at least minPts neighbours; border points are reachable from a core point but are not themselves dense; noise is neither."
        >
          {counts.core ?? 0} core · {counts.border ?? 0} border · {counts.noise ?? 0} noise
        </span>
      )}
    </div>
  );
}

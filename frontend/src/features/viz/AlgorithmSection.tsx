import { useMemo, useRef } from "react";

import { ClayBadge, ClayButton, ClayCard, Marquee, Tick } from "../../clay";
import { formatMetric, formatMs, formatParams } from "../../lib/format";
import { labelsAt } from "../../lib/trace";
import type { AlgorithmKey } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { ExportBar } from "../export/ExportBar";
import { ClusterLegend } from "../metrics/ClusterLegend";
import { MetricsPanel } from "../metrics/MetricsPanel";
import { ParamPanel } from "../params/ParamPanel";
import { TheoryNotes } from "../theory/TheoryNotes";
import { CFTreeView } from "./CFTreeView";
import { ScatterCanvas } from "./ScatterCanvas";
import { TracePlayer } from "./TracePlayer";
import { overlayFor } from "./overlays";
import type { SerialisedTree } from "./treeLayout";
import { TRACE_LIMIT, useAlgorithmRun, useInView, useStepProgress } from "./useAlgorithmRun";

const TITLE: Record<AlgorithmKey, string> = {
  dbscan: "DBSCAN",
  birch: "BIRCH",
  cure: "CURE",
};

const TAGLINE: Record<AlgorithmKey, string> = {
  dbscan: "Density reachability",
  birch: "Clustering features",
  cure: "Shrinking representatives",
};

/**
 * One algorithm, one screen.
 *
 * The page reads top to bottom as a sequence rather than a dashboard: data
 * first, then each algorithm in turn on the same points. The plot leads and the
 * theory sits in the margin, deliberately compressed — in a live demo the chart
 * has to be the thing the room is looking at.
 */
export function AlgorithmSection({
  algorithm,
  index,
}: {
  algorithm: AlgorithmKey;
  index: number;
}) {
  // One observer, two jobs: `seen` fires 200px early so the algorithm has
  // started computing by the time the section is on screen, and it also drives
  // the reveal. Revealing on the same early trigger means the transition has
  // finished before the section is fully in view, rather than animating under
  // the reader's eyes.
  // Each section owns a handle on its own plot, so Export PNG saves this
  // algorithm rather than whichever canvas is first in the document.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { ref, seen } = useInView<HTMLElement>();
  const { run, busy } = useAlgorithmRun(algorithm, seen);

  const points = useAppStore((s) => s.points);
  const pointNames = useAppStore((s) => s.pointNames);
  const result = useAppStore((s) => s.results[algorithm]) ?? null;
  const playhead = useAppStore((s) => s.playhead);
  const activeAlgorithm = useAppStore((s) => s.algorithm);
  const setAlgorithm = useAppStore((s) => s.setAlgorithm);

  const steps = useMemo(() => result?.trace.steps ?? [], [result]);
  // The transport bar is shared, so only the section the user last touched
  // follows the playhead. The others hold their finished state.
  const isActive = activeAlgorithm === algorithm;
  const currentStep =
    isActive && steps.length > 0 ? (steps[Math.min(playhead, steps.length - 1)] ?? null) : null;

  const shownPoints = result?.projection.points_2d ?? points;
  const shownLabels = useMemo(() => {
    if (isActive && steps.length > 0) return labelsAt(steps, playhead, shownPoints.length);
    return result?.labels ?? new Array<number>(shownPoints.length).fill(-1);
  }, [isActive, steps, playhead, shownPoints.length, result]);

  // Sub-step progress drives CURE's shrink tween. Keyed on the playhead so each
  // step replays the movement; inactive sections key on a constant and hold at 1.
  const stepProgress = useStepProgress(isActive ? playhead : "idle");
  const overlay = useMemo(
    () => overlayFor(algorithm, currentStep, shownPoints, stepProgress),
    [algorithm, currentStep, shownPoints, stepProgress],
  );

  const caption = result ? formatParams(result.params_used) : undefined;
  const treeFromStep = (currentStep?.payload.tree as SerialisedTree | undefined) ?? null;
  const finalTree = (result?.extras.cf_tree as SerialisedTree | undefined) ?? null;
  const traceSuppressed = points.length > TRACE_LIMIT;

  return (
    <section
      ref={ref}
      className={`deck-section ${seen ? "is-revealed" : ""}`}
      onMouseDown={() => setAlgorithm(algorithm)}
    >
      <header className="deck-heading">
        <span className="deck-numeral" aria-hidden="true">
          {String(index).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          {/* Keyed on the run's identity so a fresh result remounts the heading
              and replays the tear. During a demo it makes the exact moment the
              numbers change impossible to miss. */}
          <h2
            key={result ? `${result.runtime_ms}-${result.n_clusters}` : "idle"}
            className="clay-display clay-glitch text-3xl font-black tracking-tighter leading-none"
          >
            {TITLE[algorithm]}
          </h2>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em] mt-1"
            style={{ color: "var(--clay-accent)" }}
          >
            {TAGLINE[algorithm]}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {busy && <ClayBadge tone="accent">running…</ClayBadge>}
          {result && <ClayBadge tone="accent">{result.n_clusters} clusters</ClayBadge>}
          {result && result.n_noise > 0 && <ClayBadge>{result.n_noise} noise</ClayBadge>}
          {result && <ClayBadge>{formatMs(result.runtime_ms)}</ClayBadge>}
          <ClayButton size="sm" onClick={() => void run()} disabled={points.length === 0 || busy}>
            Re-run
          </ClayButton>
        </div>
      </header>

      {/* Each section carries its own ticker of that algorithm's live figures.
          Alternating the direction stops the three reading as one long belt. */}
      <Marquee
        tone={isActive ? "accent" : "quiet"}
        speed={24}
        reverse={index % 2 === 0}
        className="mb-4"
      >
        <Tick>{TITLE[algorithm]}</Tick>
        <Tick>{caption || "not run yet"}</Tick>
        {result && <Tick>{result.n_clusters} clusters</Tick>}
        {result && <Tick>{result.n_noise} noise</Tick>}
        {result && <Tick>silhouette {formatMetric(result.metrics.silhouette, 3)}</Tick>}
        {result && <Tick>davies-bouldin {formatMetric(result.metrics.davies_bouldin, 3)}</Tick>}
        <Tick>{TAGLINE[algorithm]}</Tick>
      </Marquee>

      <div className="deck-body">
        <ClayCard
          accent={algorithm}
          title="Result"
          subtitle={caption || undefined}
          glow={isActive}
          tilt={false}
          className={`${isActive ? "clay-ring" : ""} ${busy ? "clay-scanning" : ""}`}
        >
          <ScatterCanvas
            canvasRef={canvasRef}
            points={shownPoints}
            labels={shownLabels}
            pointTypes={result?.extras.point_types as string[] | undefined}
            pointNames={pointNames}
            overlay={overlay}
            caption={caption}
            height={440}
          />

          <div className="mt-4">
            <ClusterLegend result={result} />
          </div>

          {isActive ? (
            <div className="mt-4">
              <TracePlayer
                steps={steps}
                truncated={result?.trace.truncated ?? false}
                sampleRate={result?.trace.sample_rate ?? 1}
              />
            </div>
          ) : (
            <p className="mt-4 text-[11px]" style={{ color: "var(--clay-text-faint)" }}>
              Click this panel to take over the transport bar and step through {TITLE[algorithm]}.
            </p>
          )}

          {isActive && currentStep && (
            <p
              // The blinking block cursor reads as a live terminal readout,
              // which is exactly what the narration is.
              className="mt-4 text-sm font-bold leading-snug min-h-[2.6rem] clay-caret"
              style={{ color: "var(--clay-text)" }}
              aria-live="polite"
            >
              {currentStep.narration}
            </p>
          )}

          {traceSuppressed && (
            <p className="mt-3">
              <ClayBadge tone="warn">
                {points.length} points — trace suppressed above {TRACE_LIMIT}
              </ClayBadge>
            </p>
          )}
        </ClayCard>

        <div className="flex flex-col gap-4 min-w-0">
          <ClayCard title="Parameters" tilt={false}>
            <ParamPanel algorithm={algorithm} />
          </ClayCard>

          <ClayCard title="Notes" tilt={false} tone="sunken">
            <TheoryNotes algorithm={algorithm} />
          </ClayCard>

          {/* MetricsPanel rather than a hand-rolled stat grid: it already
              carries the params actually used, the rolling numerals, and the
              PCA explained-variance note, all of which the local version had
              silently dropped. */}
          <MetricsPanel result={result} />

          {result && (
            <ClayCard title="Export" tilt={false}>
              <ExportBar result={result} canvasRef={canvasRef} />
            </ClayCard>
          )}
        </div>
      </div>

      {algorithm === "birch" && (finalTree || treeFromStep) && (
        <ClayCard
          title="CF-tree"
          subtitle="The compressed summary BIRCH clusters instead of the raw points"
          tilt={false}
          className="mt-4"
        >
          <CFTreeView
            tree={treeFromStep ?? finalTree}
            highlightPath={(currentStep?.payload.path as number[] | undefined) ?? []}
            splitNodes={(currentStep?.payload.split_nodes as number[] | undefined) ?? []}
          />
        </ClayCard>
      )}
    </section>
  );
}


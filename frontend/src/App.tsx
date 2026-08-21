import { useEffect, useMemo, useRef, useState } from "react";

import { Aurora, ClayBadge, ClayButton, ClayCard, ClayTabs, ClayToggle } from "./clay";
import { api } from "./lib/api";
import { formatParams } from "./lib/format";
import { labelsAt } from "./lib/trace";
import type { AlgorithmKey } from "./lib/types";
import { useAppStore } from "./store/appStore";
import { CompareGrid } from "./features/compare/CompareGrid";
import { DataPanel } from "./features/data/DataPanel";
import { ExportBar } from "./features/export/ExportBar";
import { MetricsPanel } from "./features/metrics/MetricsPanel";
import { NarrationLog } from "./features/metrics/NarrationLog";
import { ParamPanel } from "./features/params/ParamPanel";
import { TheoryPanel } from "./features/theory/TheoryPanel";
import { CFTreeView } from "./features/viz/CFTreeView";
import { ScatterCanvas } from "./features/viz/ScatterCanvas";
import { TracePlayer } from "./features/viz/TracePlayer";
import { overlayFor } from "./features/viz/overlays";
import type { SerialisedTree } from "./features/viz/treeLayout";

const ALGO_TABS = [
  { id: "dbscan", label: "DBSCAN" },
  { id: "birch", label: "BIRCH" },
  { id: "cure", label: "CURE" },
];

const VIEW_TABS = [
  { id: "explore", label: "Explore" },
  { id: "compare", label: "Compare" },
  { id: "theory", label: "Theory" },
];

const TAGLINE: Record<AlgorithmKey, string> = {
  dbscan: "density reachability",
  birch: "clustering features",
  cure: "shrinking representatives",
};

/** Above this many points a recorded trace is more payload than it is worth. */
const TRACE_LIMIT = 800;

export default function App() {
  const store = useAppStore();
  const {
    points,
    featureNames,
    algorithm,
    params,
    results,
    playhead,
    autoRun,
    standardize,
    recordTrace,
    theme,
    backendOk,
    busy,
    error,
  } = store;

  const [view, setView] = useState("explore");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    api.algorithms().then(store.setSpecs).catch(() => {});
    const check = () => api.health().then(store.setBackendOk);
    void check();
    const timer = setInterval(check, 10_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retint the whole interface to the algorithm in focus.
  useEffect(() => {
    document.documentElement.setAttribute("data-algo", algorithm);
  }, [algorithm]);

  async function run() {
    if (points.length === 0) return;
    store.setBusy(true);
    try {
      const result = await api.cluster(algorithm, {
        points,
        params: params[algorithm],
        record_trace: recordTrace && points.length <= TRACE_LIMIT,
        standardize,
      });
      store.setResult(algorithm, result);
      store.setError(null);
    } catch (caught) {
      store.setError((caught as Error).message);
    } finally {
      store.setBusy(false);
    }
  }

  // Auto-run is debounced so dragging a slider does not flood the backend with
  // a request per pixel.
  useEffect(() => {
    if (!autoRun || points.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void run(), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, params[algorithm], algorithm, standardize, recordTrace, autoRun]);

  const result = results[algorithm] ?? null;
  const steps = useMemo(() => result?.trace.steps ?? [], [result]);
  const currentStep =
    steps.length > 0 ? (steps[Math.min(playhead, steps.length - 1)] ?? null) : null;

  const shownPoints = result?.projection.points_2d ?? points;
  const shownLabels = useMemo(
    () =>
      steps.length > 0
        ? labelsAt(steps, playhead, shownPoints.length)
        : (result?.labels ?? new Array<number>(shownPoints.length).fill(-1)),
    [steps, playhead, shownPoints.length, result],
  );

  const overlay = useMemo(
    () => overlayFor(algorithm as AlgorithmKey, currentStep, shownPoints, 1),
    [algorithm, currentStep, shownPoints],
  );

  const treeFromStep = (currentStep?.payload.tree as SerialisedTree | undefined) ?? null;
  const finalTree = (result?.extras.cf_tree as SerialisedTree | undefined) ?? null;
  const caption = result ? formatParams(result.params_used) : undefined;
  const traceSuppressed = recordTrace && points.length > TRACE_LIMIT;

  const rail = "rail clay-scroll";

  return (
    <div className="h-full flex flex-col relative" style={{ isolation: "isolate" }}>
      <Aurora />

      <header
        className="relative z-10 flex items-center gap-4 px-6 py-4 flex-wrap shrink-0"
        style={{
          background: "color-mix(in srgb, var(--clay-surface) 72%, transparent)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid color-mix(in srgb, var(--clay-accent) 14%, transparent)",
        }}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="clay-display text-2xl font-black tracking-tighter">
            Clustering&nbsp;Explorer
          </h1>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.16em] hidden sm:inline"
            style={{ color: "var(--clay-accent)" }}
          >
            {TAGLINE[algorithm]}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ClayBadge tone={backendOk ? "good" : "warn"}>
            {backendOk ? "backend connected" : "backend unreachable"}
          </ClayBadge>
          {busy && <ClayBadge tone="accent">working…</ClayBadge>}
          {points.length > 0 && <ClayBadge>{points.length} pts</ClayBadge>}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div style={{ minWidth: 300 }}>
            <ClayTabs tabs={VIEW_TABS} active={view} onChange={setView} />
          </div>
          <ClayButton size="sm" onClick={store.toggleTheme} title="Toggle light and dark">
            {theme === "light" ? "Dark" : "Light"}
          </ClayButton>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 px-6 pt-4">
        {!backendOk && (
          <ClayCard className="mb-4">
            <p className="text-xs leading-relaxed" style={{ color: "var(--clay-warn)" }}>
              The backend is not responding. From the <code>backend</code> directory, run{" "}
              <code>.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000</code>
            </p>
          </ClayCard>
        )}

        {error && (
          <ClayCard className="mb-4">
            <p className="text-xs" style={{ color: "var(--clay-warn)" }}>
              {error}
            </p>
          </ClayCard>
        )}

        {view === "compare" ? (
          <div className="full-scroll clay-scroll">
            <CompareGrid />
          </div>
        ) : view === "theory" ? (
          <div
            className="full-scroll clay-scroll grid gap-4 items-start"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}
          >
            <TheoryPanel algorithm="dbscan" />
            <TheoryPanel algorithm="birch" />
            <TheoryPanel algorithm="cure" />
          </div>
        ) : (
          // Three rails that scroll independently, so the plot never leaves the
          // viewport while you read metrics or scroll parameters.
          <div className="explore-grid clay-scroll">
            <div className={rail}>
              <DataPanel />
              <ClayCard title="Parameters" accent="tune" delay={60}>
                <div className="mb-4">
                  <ClayTabs
                    tabs={ALGO_TABS}
                    active={algorithm}
                    onChange={(id) => store.setAlgorithm(id as AlgorithmKey)}
                  />
                </div>
                <ParamPanel algorithm={algorithm} />
                <ClayToggle
                  label="Auto-run on change"
                  checked={autoRun}
                  onChange={store.setAutoRun}
                />
                <ClayToggle
                  label="Standardise features"
                  checked={standardize}
                  onChange={store.setStandardize}
                  help="Z-score each column. eps and threshold are scale-sensitive."
                />
                <ClayToggle
                  label="Record steps"
                  checked={recordTrace}
                  onChange={store.setRecordTrace}
                  help={`Suppressed automatically above ${TRACE_LIMIT} points.`}
                />
                {traceSuppressed && (
                  <p className="mb-3">
                    <ClayBadge tone="warn">
                      {points.length} points — trace suppressed for this run
                    </ClayBadge>
                  </p>
                )}
                <ClayButton variant="primary" onClick={run} disabled={points.length === 0}>
                  Run {algorithm.toUpperCase()}
                </ClayButton>
              </ClayCard>
            </div>

            <div className={rail}>
              <ClayCard
                title="Visualisation"
                accent={algorithm}
                subtitle={caption || undefined}
                glow
              >
                <ScatterCanvas
                  points={shownPoints}
                  labels={shownLabels}
                  pointTypes={result?.extras.point_types as string[] | undefined}
                  overlay={overlay}
                  editable={featureNames.length === 2}
                  onAddPoint={(point) => store.addPoint(point)}
                  onMovePoint={(index, point) => store.movePoint(index, point)}
                  onRemovePoint={(index) => store.removePoint(index)}
                  caption={caption}
                  height={560}
                />
                <div className="mt-4">
                  <TracePlayer
                    steps={steps}
                    truncated={result?.trace.truncated ?? false}
                    sampleRate={result?.trace.sample_rate ?? 1}
                  />
                </div>
              </ClayCard>

              {algorithm === "birch" && (
                <ClayCard
                  title="CF-tree"
                  accent="structure"
                  subtitle="Highlighted nodes are on the current insertion path"
                  delay={100}
                >
                  <CFTreeView
                    tree={treeFromStep ?? finalTree}
                    highlightPath={(currentStep?.payload.path as number[] | undefined) ?? []}
                    splitNodes={(currentStep?.payload.split_nodes as number[] | undefined) ?? []}
                  />
                </ClayCard>
              )}
            </div>

            <div className={rail}>
              <MetricsPanel result={result} />
              <NarrationLog steps={steps} playhead={playhead} />
              <ClayCard title="Export" accent="save" delay={140}>
                <ExportBar result={result} />
              </ClayCard>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Aurora,
  BackgroundType,
  ClayBadge,
  ClayButton,
  ClayCard,
  ClayTabs,
  ClayToggle,
  Marquee,
  Tick,
} from "./clay";
import { api } from "./lib/api";
import { formatMetric, formatMs, formatParams } from "./lib/format";
import { guardCureParams } from "./lib/cureGuard";
import { labelsAt } from "./lib/trace";
import type { AlgorithmKey } from "./lib/types";
import { useAppStore } from "./store/appStore";
import { CompareGrid } from "./features/compare/CompareGrid";
import { DataPanel } from "./features/data/DataPanel";
import { ClusterLegend } from "./features/metrics/ClusterLegend";
import { TheoryPanel } from "./features/theory/TheoryPanel";
import { AlgorithmSection } from "./features/viz/AlgorithmSection";
import { ScatterCanvas } from "./features/viz/ScatterCanvas";
import { TracePlayer } from "./features/viz/TracePlayer";
import { overlayFor } from "./features/viz/overlays";


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
  /**
   * Present mode drops the two side rails and gives the whole width to the plot,
   * the transport bar, and one large narration line. Everything stays live — it
   * is the same state, re-laid-out for an audience rather than an operator.
   */
  const [presenting, setPresenting] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Escape leaves Present mode; nothing else in the app traps the key.
  useEffect(() => {
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresenting(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting]);

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
      // CURE's merge phase is cubic; above the threshold we fill in a sample
      // size rather than let the UI block for a minute. The badge below says so.
      const effective =
        algorithm === "cure"
          ? guardCureParams(params.cure, points.length).params
          : params[algorithm];

      const result = await api.cluster(algorithm, {
        points,
        params: effective,
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

  const caption = result ? formatParams(result.params_used) : undefined;
  // Present mode gives the plot the vertical space the rails were using.
  const presentHeight = Math.max(420, Math.round((window.innerHeight || 900) * 0.56));


  return (
    <div className="h-full flex flex-col relative" style={{ isolation: "isolate" }}>
      <BackgroundType />
      <Aurora />
      <div className="clay-grain" aria-hidden="true" />

      <header
        className="relative z-10 flex items-center gap-4 px-6 py-4 flex-wrap shrink-0"
        style={{
          background: "var(--clay-surface)",
          borderBottom: "var(--clay-border-thick)",
        }}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="clay-display clay-title-3d text-2xl font-black tracking-tighter">
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
          {!presenting && (
            <div style={{ minWidth: 300 }}>
              <ClayTabs tabs={VIEW_TABS} active={view} onChange={setView} />
            </div>
          )}
          <ClayButton
            size="sm"
            variant={presenting ? "primary" : "ghost"}
            active={presenting}
            onClick={() => {
              setPresenting((on) => !on);
              setView("explore");
            }}
            title={presenting ? "Leave Present mode (Esc)" : "Fill the screen with the plot"}
          >
            {presenting ? "Exit present" : "Present"}
          </ClayButton>
          <ClayButton size="sm" onClick={store.toggleTheme} title="Toggle light and dark">
            {theme === "light" ? "Dark" : "Light"}
          </ClayButton>
        </div>
      </header>

      {/* Status ticker. Everything on it is live state, so it doubles as a
          readout rather than being decoration that happens to move. */}
      <Marquee tone="ink" speed={30} className="relative z-10 shrink-0">
        <Tick>DBSCAN · density reachability</Tick>
        <Tick>BIRCH · clustering features</Tick>
        <Tick>CURE · shrinking representatives</Tick>
        <Tick>{points.length} points loaded</Tick>
        <Tick>{store.datasetName}</Tick>
        <Tick>{backendOk ? "backend online" : "backend offline"}</Tick>
        <Tick>from-scratch implementations · no scikit-learn</Tick>
      </Marquee>

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

        {presenting ? (
          <div className="full-scroll clay-scroll">
            <ClayCard
              title="Visualisation"
              accent={algorithm}
              subtitle={caption || undefined}
              glow
              tilt={false}
              className={`clay-ring ${store.isPlaying ? "clay-beating" : ""}`}
              actions={<ClayBadge tone="accent">{points.length} points</ClayBadge>}
            >
              <ScatterCanvas
                points={shownPoints}
                labels={shownLabels}
                pointTypes={result?.extras.point_types as string[] | undefined}
                pointNames={store.pointNames}
                overlay={overlay}
                caption={caption}
                height={presentHeight}
              />

              <div className="mt-4">
                <ClusterLegend result={result} />
              </div>

              <div className="mt-4">
                <TracePlayer
                  steps={steps}
                  truncated={result?.trace.truncated ?? false}
                  sampleRate={result?.trace.sample_rate ?? 1}
                />
              </div>

              {/* One line, set large. In a demo the narration is the thing the
                  room is reading, so it gets the typographic weight the rail
                  version cannot afford. */}
              <p
                className="mt-5 text-lg font-bold leading-snug min-h-[3.2rem]"
                style={{ color: "var(--clay-text)" }}
                aria-live="polite"
              >
                {currentStep?.narration ?? "Press play to step through the algorithm."}
              </p>

              {result && (
                <div
                  className="mt-3 flex flex-wrap gap-2 text-xs"
                  style={{ color: "var(--clay-text-muted)" }}
                >
                  <ClayBadge tone="accent">{result.n_clusters} clusters</ClayBadge>
                  {result.n_noise > 0 && <ClayBadge>{result.n_noise} noise</ClayBadge>}
                  <ClayBadge>silhouette {formatMetric(result.metrics.silhouette, 3)}</ClayBadge>
                  <ClayBadge>DB {formatMetric(result.metrics.davies_bouldin, 3)}</ClayBadge>
                  <ClayBadge>{formatMs(result.runtime_ms)}</ClayBadge>
                </div>
              )}
            </ClayCard>
          </div>
        ) : view === "compare" ? (
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
          // The deck: one scroll, data first, then each algorithm in turn on the
          // same points. Reads as a sequence rather than a control panel.
          <div className="deck clay-scroll">
            {/* Always revealed: this section is at the top of the scroll and is
                on screen from the first frame, so it has nothing to animate in
                from — and without the class the reveal rule would leave it at
                opacity 0 forever. */}
            <section className="deck-section is-revealed">
              <header className="deck-heading">
                <span className="deck-numeral" aria-hidden="true">
                  00
                </span>
                <div className="min-w-0">
                  <h2 className="clay-display text-3xl font-black tracking-tighter leading-none">
                    Data
                  </h2>
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.16em] mt-1"
                    style={{ color: "var(--clay-accent)" }}
                  >
                    {points.length > 0
                      ? `${points.length} points · ${featureNames.length}D · ${store.datasetName}`
                      : "Nothing loaded yet"}
                  </p>
                </div>
                {/* shrink-0 stops these being squeezed by the heading beside
                    them, which was clipping the second label at narrow widths. */}
                <div className="ml-auto flex items-center gap-4 shrink-0">
                  <ClayToggle
                    label="Auto-run"
                    checked={autoRun}
                    onChange={store.setAutoRun}
                    help="Re-cluster 300ms after any change, once a section is in view."
                  />
                  <ClayToggle
                    label="Standardise"
                    checked={standardize}
                    onChange={store.setStandardize}
                    help="Z-score each column. eps and threshold are scale-sensitive."
                  />
                </div>
              </header>
              <div className="deck-body">
                <DataPanel />
                <ClayCard title="Reading this page" tone="sunken" tilt={false}>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--clay-text-muted)" }}>
                    Load a dataset here, then scroll. Each algorithm runs on the same
                    points and appears in turn, with its parameters and a short note on
                    how it works beside the plot.
                  </p>
                  <p
                    className="text-xs leading-relaxed mt-3"
                    style={{ color: "var(--clay-text-muted)" }}
                  >
                    Click a plot to give it the transport bar, then press play to watch
                    that algorithm run step by step. The full theory for all three is on
                    the Theory tab.
                  </p>
                </ClayCard>
              </div>
            </section>

            <AlgorithmSection algorithm="dbscan" index={1} />
            <AlgorithmSection algorithm="birch" index={2} />
            <AlgorithmSection algorithm="cure" index={3} />
          </div>
        )}
      </main>
    </div>
  );
}

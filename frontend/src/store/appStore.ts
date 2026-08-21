import { create } from "zustand";

import type { AlgorithmKey, AlgorithmSpec, ClusterResponse } from "../lib/types";

type ParamValue = number | string | boolean | null;

interface AppState {
  points: number[][];
  featureNames: string[];
  sourceLabels: number[] | null;
  /** Display names from an imported label column, aligned with `points`. */
  pointNames: string[] | null;
  datasetName: string;

  specs: Record<AlgorithmKey, AlgorithmSpec> | null;
  algorithm: AlgorithmKey;
  params: Record<AlgorithmKey, Record<string, ParamValue>>;

  results: Partial<Record<AlgorithmKey, ClusterResponse>>;
  compareResults: Record<AlgorithmKey, ClusterResponse> | null;

  playhead: number;
  isPlaying: boolean;
  speed: number;

  autoRun: boolean;
  standardize: boolean;
  recordTrace: boolean;
  theme: "light" | "dark";
  backendOk: boolean;
  busy: boolean;
  error: string | null;

  setPoints: (
    points: number[][],
    featureNames: string[],
    sourceLabels: number[] | null,
    name: string,
    pointNames?: string[] | null,
  ) => void;
  addPoint: (point: number[]) => void;
  movePoint: (index: number, point: number[]) => void;
  removePoint: (index: number) => void;
  clearPoints: () => void;

  setSpecs: (specs: Record<AlgorithmKey, AlgorithmSpec>) => void;
  setAlgorithm: (algorithm: AlgorithmKey) => void;
  setParam: (algorithm: AlgorithmKey, name: string, value: ParamValue) => void;

  setResult: (algorithm: AlgorithmKey, result: ClusterResponse) => void;
  setCompareResults: (results: Record<AlgorithmKey, ClusterResponse> | null) => void;

  setPlayhead: (step: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;

  setAutoRun: (value: boolean) => void;
  setStandardize: (value: boolean) => void;
  setRecordTrace: (value: boolean) => void;
  toggleTheme: () => void;
  setBackendOk: (ok: boolean) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Any change to the data invalidates every result computed from it. Clearing
 * these together stops the UI from showing a plot whose labels belong to a
 * dataset the user has already replaced.
 */
const CLEARED = { results: {}, compareResults: null, playhead: 0, isPlaying: false } as const;

export const useAppStore = create<AppState>((set) => ({
  points: [],
  featureNames: ["x", "y"],
  sourceLabels: null,
  pointNames: null,
  datasetName: "empty",

  specs: null,
  algorithm: "dbscan",
  params: { dbscan: {}, birch: {}, cure: {} },

  results: {},
  compareResults: null,

  playhead: 0,
  isPlaying: false,
  speed: 1,

  autoRun: true,
  standardize: false,
  recordTrace: true,
  theme: "light",
  backendOk: false,
  busy: false,
  error: null,

  setPoints: (points, featureNames, sourceLabels, datasetName, pointNames = null) =>
    set({ points, featureNames, sourceLabels, datasetName, pointNames, ...CLEARED }),
  // Hand-edited points have no ground truth, so any imported labels are dropped.
  // A freshly clicked point also has no name, and a partly-named set would put
  // the wrong caption against the wrong dot, so the names go too.
  addPoint: (point) =>
    set((s) => ({
      points: [...s.points, point],
      sourceLabels: null,
      pointNames: null,
      ...CLEARED,
    })),
  // Dragging changes a point's position, not which point it is: the name rides
  // along. Ground truth is dropped because the moved point may no longer belong
  // to the group it was labelled with.
  movePoint: (index, point) =>
    set((s) => ({
      points: s.points.map((p, i) => (i === index ? point : p)),
      sourceLabels: null,
      ...CLEARED,
    })),
  removePoint: (index) =>
    set((s) => ({
      points: s.points.filter((_, i) => i !== index),
      sourceLabels: null,
      // Filter names by the same index so the survivors stay aligned.
      pointNames: s.pointNames ? s.pointNames.filter((_, i) => i !== index) : null,
      ...CLEARED,
    })),
  clearPoints: () =>
    set({
      points: [],
      sourceLabels: null,
      pointNames: null,
      datasetName: "empty",
      ...CLEARED,
    }),

  setSpecs: (specs) =>
    set({
      specs,
      params: {
        dbscan: Object.fromEntries(specs.dbscan.params.map((p) => [p.name, p.default])),
        birch: Object.fromEntries(specs.birch.params.map((p) => [p.name, p.default])),
        cure: Object.fromEntries(specs.cure.params.map((p) => [p.name, p.default])),
      } as AppState["params"],
    }),
  setAlgorithm: (algorithm) => set({ algorithm, playhead: 0, isPlaying: false }),
  setParam: (algorithm, name, value) =>
    set((s) => ({
      params: { ...s.params, [algorithm]: { ...s.params[algorithm], [name]: value } },
    })),

  // Only the active algorithm's result may move the shared transport bar.
  // Sections auto-run lazily as they scroll into view, so an unconditional
  // reset meant that scrolling toward BIRCH while watching DBSCAN play would
  // rewind and stop DBSCAN's playback when BIRCH's background run resolved —
  // the transport pulled out from under the thing the user was watching.
  setResult: (algorithm, result) =>
    set((s) => ({
      results: { ...s.results, [algorithm]: result },
      ...(algorithm === s.algorithm ? { playhead: 0, isPlaying: false } : {}),
    })),
  setCompareResults: (compareResults) => set({ compareResults }),

  setPlayhead: (playhead) => set({ playhead }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setSpeed: (speed) => set({ speed }),

  setAutoRun: (autoRun) => set({ autoRun }),
  setStandardize: (standardize) => set({ standardize }),
  setRecordTrace: (recordTrace) => set({ recordTrace }),
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      return { theme };
    }),
  setBackendOk: (backendOk) => set({ backendOk }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
}));

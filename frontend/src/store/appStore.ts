import { create } from "zustand";

import type { AlgorithmKey, AlgorithmSpec, ClusterResponse } from "../lib/types";

type ParamValue = number | string | boolean | null;

interface AppState {
  points: number[][];
  featureNames: string[];
  sourceLabels: number[] | null;
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

  setPoints: (points, featureNames, sourceLabels, datasetName) =>
    set({ points, featureNames, sourceLabels, datasetName, ...CLEARED }),
  // Hand-edited points have no ground truth, so any imported labels are dropped.
  addPoint: (point) =>
    set((s) => ({ points: [...s.points, point], sourceLabels: null, ...CLEARED })),
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
      ...CLEARED,
    })),
  clearPoints: () => set({ points: [], sourceLabels: null, datasetName: "empty", ...CLEARED }),

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

  setResult: (algorithm, result) =>
    set((s) => ({ results: { ...s.results, [algorithm]: result }, playhead: 0, isPlaying: false })),
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

# Clustering Explorer — Design Spec

**Date:** 2026-08-20
**Purpose:** DWDM assignment demonstrating DBSCAN, BIRCH, and CURE.

## 1. Goal

A two-part deliverable:

1. **`backend/`** — a Python package implementing DBSCAN, BIRCH, and CURE **from scratch**, exposed over a FastAPI HTTP API. No scikit-learn: the three algorithms, the clustering-quality metrics, and PCA are all hand-written, because implementing them is the assignment.
2. **`frontend/`** — a React single-page app with a claymorphism UI that drives the backend: load data, tune parameters, watch each algorithm run step-by-step, compare all three side by side, read the theory, export results.

Success means: a person who has never seen the algorithms can watch the app for two minutes and understand what each one actually does, and the code is clean enough to submit and defend in a viva.

## 2. Non-goals

- Not a general-purpose ML library. Three algorithms, done well.
- No persistence layer, no accounts, no multi-user. Data lives in browser state.
- No deployment/hosting story. It runs locally on the demo machine.
- No streaming/incremental clustering beyond what BIRCH inherently does.

## 3. Constraints

- Python 3.13 installed via winget at project start (no prior Python on machine).
- Backend dependencies limited to `fastapi`, `uvicorn[standard]`, `numpy`, `pydantic`, plus `pytest` and `httpx` for tests. Nothing else.
- Frontend: Vite + React + TypeScript + Tailwind CSS. Charting is hand-written on `<canvas>`; no charting library.
- Runs on Windows; all tooling must work from PowerShell.

## 4. Architecture

```
DWDM/
├─ backend/
│  ├─ pyproject.toml
│  ├─ app/
│  │  ├─ main.py                FastAPI app, CORS, router mounting
│  │  ├─ api/routes.py          HTTP endpoints
│  │  ├─ schemas.py             Pydantic request/response models
│  │  ├─ algorithms/
│  │  │  ├─ trace.py            Step / TraceRecorder / ClusterResult
│  │  │  ├─ dbscan.py
│  │  │  ├─ birch.py            CFEntry, CFNode, CFTree, birch()
│  │  │  └─ cure.py
│  │  ├─ data/
│  │  │  ├─ generators.py       synthetic datasets
│  │  │  └─ ingest.py           CSV/JSON parsing + column selection
│  │  ├─ analysis/
│  │  │  ├─ metrics.py          silhouette, davies-bouldin, summary stats
│  │  │  └─ projection.py       PCA
│  │  └─ theory.py              per-algorithm explanatory content
│  └─ tests/
└─ frontend/
   └─ src/
      ├─ clay/                  ClayCard, ClayButton, ClaySlider, ClayToggle,
      │                         ClayTabs, ClaySelect, ClayBadge + tokens.css
      ├─ features/
      │  ├─ data/               file import, canvas point editor, generators
      │  ├─ viz/                ScatterCanvas, TracePlayer, CFTreeView, overlays
      │  ├─ params/             per-algorithm parameter panels
      │  ├─ compare/            side-by-side runner
      │  ├─ metrics/            quality metrics panel
      │  └─ theory/             algorithm explainers
      ├─ lib/                   api client, types, colors, export helpers
      └─ store/                 app state (points, params, results, playhead)
```

Data flow: the frontend holds the canonical point set, POSTs it with parameters to the backend, and receives labels, metadata, metrics, and a trace to render and animate. The backend is stateless; every request carries its own data.

## 5. The trace model

The distinguishing feature. Each algorithm records an ordered list of steps describing its own execution.

```python
class Step(TypedDict):
    i: int                         # step index
    kind: str                      # algorithm-specific step type
    narration: str                 # one plain-English sentence
    labels_delta: dict[int, int]   # point index -> new label, only what changed
    payload: dict                  # what to draw for this step
```

Labels travel as **deltas**, not snapshots; the frontend accumulates them as the playhead advances and can rebuild any prefix by replaying from zero. Backward scrubbing replays from the nearest keyframe — every 50th step also carries a full `labels_snapshot`.

Label convention across all three algorithms: `-1` = noise/unassigned, `0..k-1` = cluster ids.

### Step kinds and payloads

**DBSCAN** — `visit`, `core`, `noise`, `seed`, `expand`, `border`, `done`

Payload: `point` (index), `eps_circle` (center, radius), `neighbors` (indices), `queue` (indices currently in the seed set), `cluster_id`.

Narration examples: "Point 42 has 7 neighbours within eps=0.30 (>= minPts=5), so it is a core point and starts cluster 2."; "Point 88 has 2 neighbours and no core point claims it, so it is noise."

**BIRCH** — `insert`, `descend`, `absorb`, `new_entry`, `split`, `rebuild`, `global_cluster`, `done`

Payload: `point`, `path` (node ids traversed), `tree` (serialised CF-tree: nodes with id, parent, is_leaf, and entries as `{n, centroid, radius}`), `split_nodes`, `cluster_id`. The serialised tree carries only what the visualisation needs, not raw linear and squared sums.

Narration examples: "Adding point 130 to the closest leaf entry would push its radius to 0.62, above T=0.50, so a new entry is created."; "The leaf is full at B=6 entries, so it splits on its two farthest entries and promotes them to the parent."

**CURE** — `sample`, `init`, `merge`, `represent`, `shrink`, `assign`, `done`

Payload: `merged` (pair of cluster ids), `new_cluster_id`, `reps_before`, `reps_after` (both lists of coordinates), `centroid`, `alpha`, `clusters_remaining`. Having both `reps_before` and `reps_after` lets the frontend animate the shrink as a tween.

Narration examples: "Merging clusters 3 and 7 — their closest representatives are 0.12 apart."; "Picked 4 scattered representatives and shrank them 20% toward the centroid."

### Trace budget

Tracing is controlled by `record_trace: bool` and `max_steps: int` (default 5000). If a run would exceed `max_steps`, the recorder switches to sampling — keeping every k-th step plus all structurally significant ones (splits, merges, cluster births) — and sets `trace_truncated: true` along with the sampling rate, which the UI surfaces as a notice. Tracing defaults to on for n <= 500 and off above that; the user can override.

**Invariant:** replaying every step's `labels_delta` in order must reproduce the final `labels` array exactly. A test enforces this for every algorithm on every fixture dataset.

## 6. Algorithms

All operate on a `numpy.ndarray` of shape `(n, d)` in float64 and cluster in the data's **full dimensionality**. Projection to 2D happens only for display.

### DBSCAN

Region query by Euclidean distance, `min_pts` counting the point itself, BFS frontier expansion, border points assigned to the first cluster that reaches them. Region queries use a vectorised distance computation against all points — O(n²) overall, which is honest and fine at our scale; the complexity is stated in the theory panel rather than hidden.

Parameters: `eps` (float > 0), `min_pts` (int >= 1), `metric` (euclidean, with manhattan as a second option).

### BIRCH

Phase 1 builds a CF-tree. A clustering feature is `(n, LS, SS)`; the centroid is `LS/n` and the radius is `sqrt(max(0, SS_total/n - ||LS/n||²))`. Insertion descends by closest centroid and absorbs the point into the closest leaf entry if the resulting radius stays within `threshold`, otherwise it creates a new entry. Leaf and internal overflow splits on the two farthest entries and propagates upward, growing the root when needed.

Phase 2 runs agglomerative clustering over the leaf-entry centroids, weighted by entry counts, down to `n_clusters`; each original point takes the label of its leaf entry.

Parameters: `threshold` (T), `branching_factor` (B), `n_clusters` (optional — if omitted, the leaf entries themselves are the clusters).

### CURE

Optionally samples `sample_size` points (default: all points, for small n). Starts with each sampled point as its own cluster, then repeatedly merges the pair whose representative points are closest. After each merge it picks up to `n_representatives` well-scattered points by farthest-first traversal over the merged cluster's members, then shrinks each toward the cluster centroid by `shrink_factor` (alpha). Merging stops at `n_clusters`. Points outside the sample are labelled by nearest shrunken representative.

Parameters: `n_clusters`, `n_representatives` (c), `shrink_factor` (alpha in [0,1]), `sample_size` (optional), `random_seed`.

### Determinism

Every algorithm is deterministic given the same input and parameters. CURE's sampling takes an explicit `random_seed` (default 42). Ties in distance comparisons break by lowest index. This matters: the animation must be reproducible when the user re-runs it during a demo.

## 7. Data pipeline

**Point store.** The frontend holds `points: number[][]`, `featureNames: string[]`, and optional `sourceLabels: number[]` — ground truth used only to show what the right answer was on generated data, never fed to the algorithms.

**File import.** CSV (with or without header, delimiter sniffed) and JSON (array of objects, or array of arrays). The backend handles parsing — delimiter sniffing, header detection, type inference — and returns column names, inferred types, and the full parsed table in one response. Because the backend is stateless, the frontend then owns that table: the user picks feature columns and an optional ground-truth label column entirely client-side, which keeps column switching instant. Selecting a non-numeric column as a feature is blocked in the UI with a message naming the column. Rows with missing values in the selected features are dropped, and the dropped count is shown before clustering runs.

**Canvas editor.** Click empty space to add a point, drag a point to move it, right-click or alt-click to delete, plus a clear-all button. Available only for 2D data; for higher-dimensional data the editor is disabled with an explanatory note.

**Generators.** `blobs`, `moons`, `circles`, `anisotropic`, `varied_density`, `uneven_blobs`, `uniform_noise`. Each takes `n_samples`, `noise`, and `random_seed`. The set is deliberate: moons and circles break BIRCH and centroid-based thinking, `varied_density` breaks DBSCAN's single eps, and `anisotropic` and `uneven_blobs` are where CURE's representatives earn their keep. The picker shows a one-line hint about what each dataset demonstrates.

**High-dimensional data.** When d > 2, clustering runs on all d dimensions and the scatter shows a PCA projection to 2D. The visualisation displays the explained-variance ratio of the two shown components so the user knows how much they are not seeing. A z-score standardisation toggle is offered, since `eps` and `threshold` are scale-sensitive.

## 8. API

All routes under `/api`. JSON in, JSON out, except the upload endpoint.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/algorithms` | Parameter schemas (name, type, default, min, max, step, help text) and theory content for all three. Drives both the parameter panels and the explainers. |
| GET | `/api/datasets/generators` | Available generators with their parameters and demo hints. |
| POST | `/api/datasets/generate` | `{kind, n_samples, noise, random_seed}` returns `{points, feature_names, source_labels}` |
| POST | `/api/datasets/upload` | multipart file, returns `{columns, dtypes, rows, n_rows, suggested_features}` — the full parsed table, since the backend keeps no state between calls |
| POST | `/api/cluster/{algorithm}` | `{points, params, record_trace, max_steps, standardize}` returns a `ClusterResponse` |
| POST | `/api/cluster/compare` | `{points, configs, standardize}` returns three `ClusterResponse` objects |
| POST | `/api/analysis/project` | `{points, n_components}` returns `{projected, explained_variance_ratio}` |

`ClusterResponse`:

```json
{
  "algorithm": "dbscan",
  "labels": [0, 0, -1, 1],
  "n_clusters": 3,
  "n_noise": 12,
  "params_used": {},
  "runtime_ms": 41.2,
  "metrics": {
    "silhouette": 0.61,
    "davies_bouldin": 0.74,
    "cluster_sizes": {"0": 120, "1": 98}
  },
  "projection": {"points_2d": [], "explained_variance_ratio": [0.72, 0.19]},
  "extras": {"cf_tree": {}, "representatives": {}},
  "trace": {"steps": [], "truncated": false, "sample_rate": 1}
}
```

`extras` carries the final-state structures a static view needs without replaying the trace: BIRCH's finished CF-tree, CURE's final representative points per cluster, and DBSCAN's core/border/noise classification per point.

Errors return `{"error": {"code": "...", "message": "...", "field": "..."}}` with a 4xx status. Validation covers empty point sets, ragged rows, non-finite values, `eps <= 0`, `n_clusters > n_points`, `shrink_factor` outside [0,1], and `branching_factor < 2`.

## 9. Frontend

**Layout.** Three regions: a left rail for data source and parameters, a large central stage for the visualisation, and a right rail for metrics and narration. On narrow screens they stack vertically. The transport bar sits under the stage.

**ScatterCanvas.** An HTML `<canvas>` with devicePixelRatio scaling, a data-to-screen transform with padding, and a render function taking `(points, labelState, overlay)` that draws in a single pass. It handles thousands of points smoothly where SVG would not. Interaction uses hit-testing in data space. Overlays are per-algorithm draw functions layered on top: DBSCAN's eps circle and neighbour links, BIRCH's CF-entry circles, CURE's representative rings and shrink tweens.

**TracePlayer.** Owns the playhead. Controls: play/pause, step forward, step back, scrub slider, speed from 0.25x to 8x, and jump-to-end. Playback uses `requestAnimationFrame` with a time accumulator so speed changes stay smooth and the animation is frame-rate independent. The current step's narration renders in the right rail, with the last several lines kept as a scrollable log.

**CFTreeView.** An SVG tree diagram for BIRCH using a simple tidy-tree layout. Nodes show their entry count and highlight when on the current insertion path; splits flash. It scrolls horizontally when wide.

**Compare mode.** A grid of three ScatterCanvas panels sharing one dataset and one transform, each with a metrics strip beneath. Traces are not animated in compare mode — animation is for single-algorithm study.

**Parameter panels.** Generated from `/api/algorithms` so the backend and UI cannot drift apart. Clay sliders with live numeric readouts, each carrying help text from the same source as the theory content. Parameter changes re-run clustering after a 300ms debounce, with an auto-run toggle to disable it.

**Export.** Labelled CSV (original features plus assigned cluster and noise flag), a 2x-scale PNG of the current canvas, and a JSON run report covering dataset summary, parameters, metrics, and timing, suitable for pasting into a writeup.

**Claymorphism.** Hand-built tokens in `clay/tokens.css`: a pastel surface palette, dual shadows (an outer soft drop shadow plus an inner light highlight and inner dark occlusion) that make surfaces read as pressed clay, generous border-radius, and pressed states that invert the inner shadows. Light and dark themes via CSS custom properties, following the system preference with a manual toggle. Cluster colours use a categorical palette chosen to stay distinguishable in both themes and under common colour-vision deficiencies; noise points render as small hollow grey dots in both.

**Motion.** Transitions are short (120–200ms) and animate transform and opacity only. Under `prefers-reduced-motion` the trace player still works, but step transitions become instant and the CURE shrink tween is skipped.

## 10. Testing

**Backend (pytest), written test-first.**

- *Correctness on ground truth:* each algorithm recovers well-separated blobs, measured by agreement with the generator's labels.
- *DBSCAN reference:* validated against a straightforward brute-force implementation written independently in the test file, over randomised inputs.
- *BIRCH structure:* CF additivity (merging two CFs equals the CF of the union); no leaf entry exceeds `threshold` radius; no node exceeds `branching_factor` entries; every point maps to exactly one leaf entry.
- *CURE:* representatives always number at most `n_representatives`; alpha=1 puts every representative at the centroid, degenerating to centroid-based merging; alpha=0 leaves them untouched.
- *Trace invariant:* for every algorithm and fixture, replaying `labels_delta` in order equals the returned `labels`, and keyframe snapshots agree with the accumulated state at their index.
- *Edge cases:* a single point; all duplicate points; all points noise; `n_clusters > n_points`; d=1; d=10; empty input rejected with a clear error.
- *Metrics:* silhouette and Davies-Bouldin checked against hand-computed values on a tiny fixture, and both handle the single-cluster and all-noise cases without dividing by zero.
- *API:* each endpoint's happy path and its validation failures.

**Frontend (Vitest).**

- Delta accumulation: replaying a trace prefix yields the expected label state, including backward scrubbing via keyframes.
- Data-to-screen transform: round-trips correctly and handles degenerate ranges (all points identical) without producing NaN.
- CSV parsing and column-selection edge cases.
- Exported CSV content matches the point set and labels.

## 11. Risks

- *Trace payload size.* Mitigated by deltas, keyframes, and the sampling budget. If a 500-point DBSCAN trace still exceeds a few megabytes, the sampling threshold drops.
- *CURE merging cost.* Roughly O(n² log n), so it slows past a few thousand points. Mitigated by the sampling parameter, with the sample size surfaced in the UI rather than hidden.
- *Live-demo fragility.* Two processes must be running. Mitigated by one documented start command per side in the README, a backend health check shown in the header, and an explicit "backend not reachable" state rather than a silent failure.

## 12. Out of scope for v1

Cluster hierarchy dendrograms; OPTICS and HDBSCAN; 3D visualisation; saving sessions to disk; comparing against scikit-learn's implementations.

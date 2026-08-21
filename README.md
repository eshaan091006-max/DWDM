# Clustering Explorer

DBSCAN, BIRCH, and CURE implemented from scratch in Python, with a React front
end that animates each algorithm step by step.

Built for a Data Warehousing and Data Mining assignment.

## Running it

Two processes. Open two terminals.

**Backend** — from `backend/`:

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

**Frontend** — from `frontend/`:

```bash
npm run dev
```

Then open http://localhost:5173. The header shows whether the backend is
reachable, and says how to start it if not.

The API alone is browsable at http://localhost:8000/docs if you want to poke at
the algorithms without the UI.

## Tests

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -v
```

```bash
cd frontend && npm test
```

## What is implemented from scratch

No scikit-learn, scipy, pandas, or matplotlib. The backend depends only on
numpy, FastAPI, pydantic, and a form parser for file uploads. Written by hand:

- **DBSCAN** — neighbourhood queries, core/border/noise classification, BFS
  frontier expansion. `minPts` counts the point itself, per Ester et al. (1996).
- **BIRCH** — the CF vector `(n, LS, SS)`, centroid and radius arithmetic
  derived from it, CF-tree insertion, node splitting on the two farthest
  entries with upward propagation, and a weighted agglomerative second phase
  over the leaf entries.
- **CURE** — farthest-first representative selection, shrinking toward the
  centroid, closest-representative merging, and sample-based labelling.
- **Metrics** — silhouette and Davies-Bouldin, both excluding noise points.
- **PCA** — via SVD, for projecting higher-dimensional data onto the 2D plot.

## The trace

Each algorithm records an ordered list of steps as it runs. Every step carries a
label delta, a payload of what to draw, and one sentence of narration. The front
end replays them through the transport bar under the plot, which is what turns
each algorithm from a black box into something you can watch.

Traces use deltas rather than full label snapshots, with a keyframe every 50
steps so scrubbing backwards stays fast. Runs longer than the step budget are
compacted by merging adjacent steps, and the UI says so rather than hiding it.
Above 800 points tracing is suppressed automatically.

A test on every algorithm asserts that replaying the whole trace reproduces the
returned labels exactly — without it, the animation could drift away from the
real result, which would be the worst possible failure for a teaching tool.

## Things worth trying

- **Two moons with DBSCAN.** Start with eps around 0.45 and watch it fragment
  into five clusters, then raise eps and watch them merge. One parameter, and
  the entire result changes — this is DBSCAN's central weakness.
- **Two moons with BIRCH.** Centroid-based thinking should fail on crescents,
  but with a small enough threshold the CF-tree is fine-grained enough that the
  second phase reassembles them.
- **Varied density with DBSCAN.** Three clusters at different densities; no
  single eps fits all three.
- **Anisotropic blobs with CURE.** Compare `c = 1, α = 1` (which degenerates to
  centroid-based) against `c = 8, α = 0.2`. At low α the representatives sit out
  at cluster edges and chain across the gaps. Raise α and the chaining stops.
- **Compare mode.** Same data, all three algorithms, side by side.

## Layout

```
backend/app/algorithms/    the three algorithms and the trace recorder
backend/app/analysis/      metrics and PCA
backend/app/data/          dataset generators and file ingestion
backend/app/registry.py    parameter schemas and theory, serving both UI and docs
frontend/src/clay/         the claymorphism component set
frontend/src/features/viz/ canvas renderer, overlays, transport bar, CF-tree
docs/superpowers/          the design spec and implementation plan
```

The algorithm registry is the single source of truth for parameters: the
sliders, the help text, and the theory pages are all generated from it, so the
UI cannot offer a knob the backend will reject.

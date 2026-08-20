# Clustering Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that implements DBSCAN, BIRCH, and CURE from scratch in Python and lets a user load data, tune parameters, and watch each algorithm execute step-by-step in an animated claymorphism UI.

**Architecture:** A stateless FastAPI backend owns all mathematics — the three algorithms, the quality metrics, and PCA are hand-written over numpy, with no scikit-learn. Each algorithm records a *trace*: an ordered list of steps carrying a label-delta, a drawing payload, and a plain-English narration line. A Vite + React frontend holds the canonical point set, POSTs it to the backend, and renders results on a hand-written `<canvas>`, replaying the trace through a transport bar.

**Tech Stack:** Python 3.13, FastAPI, uvicorn, numpy, pydantic, pytest, httpx (test client). React 19, TypeScript, Vite, Tailwind CSS v4, zustand (state), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-clustering-explorer-design.md`

## Global Constraints

- Python interpreter lives at `C:\Users\Eshunned\AppData\Local\Programs\Python\Python313\python.exe` (3.13.15). All backend commands run inside `backend/.venv`.
- **No scikit-learn, no scipy, no pandas, no matplotlib.** Backend runtime dependencies are exactly: `fastapi`, `uvicorn[standard]`, `numpy`, `pydantic`, `python-multipart`. Dev adds `pytest`, `httpx`. Any task that reaches for another library is doing it wrong.

  The point of this rule is that **every piece of clustering mathematics is written by hand** — the three algorithms, the quality metrics, and PCA. A library that would do that work for us is banned outright, and no argument justifies adding one. Plumbing is a different question: `python-multipart` is the form-data parser FastAPI's `UploadFile` requires (it is what `fastapi[standard]` bundles), it is ~30KB, and it touches nothing mathematical. It is on the list because the upload endpoint cannot exist without it, not as a precedent for relaxing the rule. If a future task wants a dependency, the test is simple: does it do arithmetic this project is supposed to demonstrate? If yes, the answer is no.
- **No charting library on the frontend.** The scatter plot is hand-written canvas 2D; the CF-tree is hand-written SVG.
- Label convention everywhere: `-1` = noise/unassigned, `0..k-1` = cluster ids.
- All algorithms cluster in the data's full dimensionality. PCA projection is display-only and never feeds an algorithm.
- All algorithms are deterministic. Distance ties break by lowest index. Any randomness takes an explicit `random_seed` defaulting to `42`.
- Arrays are `numpy.ndarray`, shape `(n, d)`, dtype `float64`.
- Every backend module is typed and every public function has a docstring stating what it returns.
- Platform is Windows; every documented command must run in PowerShell.
- Trace defaults: `record_trace=True`, `max_steps=5000`, `keyframe_every=50`.

---

## File Structure

**Backend** (`backend/`)

| File | Responsibility |
|---|---|
| `pyproject.toml` | Package metadata and dependency pins |
| `app/main.py` | FastAPI app construction, CORS, router mounting, `/api/health` |
| `app/api/routes.py` | HTTP endpoints; converts between JSON and numpy, times runs, attaches metrics |
| `app/schemas.py` | Pydantic request/response models and validation |
| `app/errors.py` | `ApiError` exception + handler producing the `{"error": {...}}` envelope |
| `app/algorithms/trace.py` | `Step`, `TraceRecorder`, `ClusterResult` — the trace machinery all three algorithms share |
| `app/algorithms/distance.py` | `pairwise_distances`, `distance_to_point` — the only place a metric is interpreted |
| `app/algorithms/dbscan.py` | DBSCAN + its trace |
| `app/algorithms/birch.py` | `CFEntry`, `CFNode`, `CFTree`, `birch()` + its trace |
| `app/algorithms/cure.py` | CURE + its trace |
| `app/data/generators.py` | Synthetic dataset generators and their metadata |
| `app/data/ingest.py` | CSV/JSON parsing, delimiter sniffing, type inference |
| `app/analysis/metrics.py` | Silhouette, Davies-Bouldin, cluster summary |
| `app/analysis/projection.py` | PCA and z-score standardisation |
| `app/registry.py` | Parameter schemas + theory content for all three algorithms; single source of truth for the UI |
| `tests/` | One test module per source module above |

**Frontend** (`frontend/src/`)

| File | Responsibility |
|---|---|
| `clay/tokens.css` | Claymorphism design tokens; light/dark palettes |
| `clay/*.tsx` | `ClayCard`, `ClayButton`, `ClaySlider`, `ClayToggle`, `ClayTabs`, `ClaySelect`, `ClayBadge` |
| `lib/types.ts` | TypeScript mirrors of every backend response shape |
| `lib/api.ts` | Typed fetch wrappers; the only place a URL string appears |
| `lib/trace.ts` | Delta accumulation, keyframe seeking |
| `lib/colors.ts` | Cluster palette, noise styling, theme-aware resolution |
| `lib/export.ts` | CSV / PNG / JSON report generation |
| `lib/csv.ts` | Client-side column selection and row filtering |
| `store/appStore.ts` | zustand store: points, params, results, playhead, theme |
| `features/viz/transform.ts` | Data-to-screen transform (pure, unit-tested) |
| `features/viz/ScatterCanvas.tsx` | The canvas renderer + pointer interaction |
| `features/viz/overlays/*.ts` | Per-algorithm draw functions |
| `features/viz/TracePlayer.tsx` | Transport bar and playback clock |
| `features/viz/CFTreeView.tsx` | BIRCH tree diagram |
| `features/data/*.tsx` | Generator picker, file import, point editor |
| `features/params/ParamPanel.tsx` | Schema-driven parameter controls |
| `features/metrics/MetricsPanel.tsx` | Quality metrics + narration log |
| `features/compare/CompareGrid.tsx` | Three-panel side-by-side |
| `features/theory/TheoryPanel.tsx` | Algorithm explainers |
| `App.tsx` | Layout shell, theme toggle, backend health indicator |

---

## Task 1: Repository, backend scaffold, and health endpoint

**Files:**
- Create: `.gitignore`, `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/main.py`, `backend/app/errors.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `create_app() -> FastAPI` in `app/main.py`; `app` module-level instance for uvicorn. `ApiError(code: str, message: str, field: str | None = None)` in `app/errors.py`, registered so it serialises to `{"error": {"code", "message", "field"}}` with the given status.

- [ ] **Step 1: Initialise the repository**

```bash
cd /c/Users/Eshunned/Projects/DWDM
git init
```

Create `.gitignore`:

```
.venv/
__pycache__/
*.pyc
.pytest_cache/
node_modules/
dist/
.DS_Store
*.local
```

- [ ] **Step 2: Create the virtual environment and install dependencies**

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install "fastapi" "uvicorn[standard]" "numpy" "pydantic" "pytest" "httpx"
```

- [ ] **Step 3: Write `backend/pyproject.toml`**

```toml
[project]
name = "clustering-explorer-backend"
version = "1.0.0"
description = "From-scratch DBSCAN, BIRCH, and CURE with execution traces"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "numpy>=2.1",
    "pydantic>=2.9",
    # Required by FastAPI's UploadFile/File for the CSV/JSON upload endpoint.
    # FastAPI checks for it at route-declaration time, so without it the whole
    # app fails to import, not just that one route.
    "python-multipart>=0.0.9",
]

[project.optional-dependencies]
dev = ["pytest>=8.3", "httpx>=0.27"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 4: Write the failing test**

`backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_reports_ok():
    client = TestClient(create_app())
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_error_is_serialised_as_envelope():
    from app.errors import ApiError

    app = create_app()

    @app.get("/api/boom")
    def boom():
        raise ApiError("bad_input", "eps must be positive", field="eps", status=422)

    client = TestClient(app)
    response = client.get("/api/boom")
    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "bad_input", "message": "eps must be positive", "field": "eps"}
    }
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_health.py -v` from `backend/`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 6: Write `backend/app/errors.py`**

```python
"""Structured API errors that serialise to a stable envelope."""

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """An error safe to show the user, carrying a machine-readable code."""

    def __init__(self, code: str, message: str, field: str | None = None, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.field = field
        self.status = status


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    """Render an ApiError as {"error": {code, message, field}}."""
    return JSONResponse(
        status_code=exc.status,
        content={"error": {"code": exc.code, "message": exc.message, "field": exc.field}},
    )
```

- [ ] **Step 7: Write `backend/app/main.py`**

```python
"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.errors import ApiError, api_error_handler


def create_app() -> FastAPI:
    """Build the application with CORS and error handling wired up."""
    app = FastAPI(title="Clustering Explorer", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(ApiError, api_error_handler)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        """Liveness probe the frontend polls to show connection state."""
        return {"status": "ok"}

    return app


app = create_app()
```

Also create an empty `backend/app/__init__.py`.

- [ ] **Step 8: Run the test to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_health.py -v`
Expected: 2 passed

- [ ] **Step 9: Commit**

```bash
git add .gitignore backend/pyproject.toml backend/app backend/tests docs
git commit -m "feat: scaffold backend with health endpoint and error envelope"
```

---

## Task 2: Trace model and distance utilities

**Files:**
- Create: `backend/app/algorithms/__init__.py`, `backend/app/algorithms/trace.py`, `backend/app/algorithms/distance.py`
- Test: `backend/tests/test_trace.py`, `backend/tests/test_distance.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Step` dataclass with fields `i: int`, `kind: str`, `narration: str`, `labels_delta: dict[int, int]`, `payload: dict`, `significant: bool`, `labels_snapshot: list[int] | None`.
  - `TraceRecorder(n_points: int, enabled: bool = True, max_steps: int = 5000, keyframe_every: int = 50)` with `.record(kind, narration, labels_delta=None, payload=None, significant=False) -> None`, `.labels -> list[int]` (live accumulated state), and `.finish() -> dict` returning `{"steps": [...], "truncated": bool, "sample_rate": int}`.
  - `ClusterResult` dataclass with `labels: list[int]`, `extras: dict`, `trace: dict`.
  - `pairwise_distances(X: np.ndarray, metric: str = "euclidean") -> np.ndarray` returning `(n, n)`.
  - `distances_to(X: np.ndarray, point: np.ndarray, metric: str = "euclidean") -> np.ndarray` returning `(n,)`.

**Design note for the implementer:** the recorder always maintains correct labels even when tracing is disabled, so algorithms have exactly one code path. When the buffer grows past `2 * max_steps` it *compacts*: adjacent non-significant step pairs merge into one, the later step's narration and payload win, and their label deltas combine with the later value taking precedence. This preserves the replay invariant while halving the buffer. If a compaction pass cannot shrink the buffer (every step is significant), the buffer is allowed to grow — correctness beats the budget.

- [ ] **Step 1: Write the failing test for distances**

`backend/tests/test_distance.py`:

```python
import numpy as np

from app.algorithms.distance import distances_to, pairwise_distances


def test_euclidean_pairwise_matches_manual():
    X = np.array([[0.0, 0.0], [3.0, 4.0]])
    D = pairwise_distances(X)
    assert D.shape == (2, 2)
    assert np.isclose(D[0, 1], 5.0)
    assert np.isclose(D[0, 0], 0.0)


def test_manhattan_pairwise_matches_manual():
    X = np.array([[0.0, 0.0], [3.0, 4.0]])
    D = pairwise_distances(X, metric="manhattan")
    assert np.isclose(D[0, 1], 7.0)


def test_pairwise_is_symmetric_with_zero_diagonal():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(12, 3))
    D = pairwise_distances(X)
    assert np.allclose(D, D.T)
    assert np.allclose(np.diag(D), 0.0)


def test_distances_to_matches_pairwise_row():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(8, 4))
    D = pairwise_distances(X)
    assert np.allclose(distances_to(X, X[3]), D[3])


def test_unknown_metric_is_rejected():
    import pytest

    with pytest.raises(ValueError):
        pairwise_distances(np.zeros((2, 2)), metric="cosine")
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_distance.py -v`
Expected: FAIL — no module named `app.algorithms.distance`

- [ ] **Step 3: Implement `backend/app/algorithms/distance.py`**

```python
"""Distance computations. The only module that interprets a metric name."""

import numpy as np

SUPPORTED_METRICS = ("euclidean", "manhattan")


def _check_metric(metric: str) -> None:
    if metric not in SUPPORTED_METRICS:
        raise ValueError(f"Unsupported metric {metric!r}; expected one of {SUPPORTED_METRICS}")


def pairwise_distances(X: np.ndarray, metric: str = "euclidean") -> np.ndarray:
    """Return the (n, n) matrix of distances between every pair of rows in X."""
    _check_metric(metric)
    diff = X[:, None, :] - X[None, :, :]
    if metric == "euclidean":
        # Clip before the square root: floating-point error can produce tiny negatives.
        D = np.sqrt(np.clip(np.sum(diff * diff, axis=-1), 0.0, None))
    else:
        D = np.sum(np.abs(diff), axis=-1)
    np.fill_diagonal(D, 0.0)
    return D


def distances_to(X: np.ndarray, point: np.ndarray, metric: str = "euclidean") -> np.ndarray:
    """Return the (n,) vector of distances from every row of X to a single point."""
    _check_metric(metric)
    diff = X - point[None, :]
    if metric == "euclidean":
        return np.sqrt(np.clip(np.sum(diff * diff, axis=-1), 0.0, None))
    return np.sum(np.abs(diff), axis=-1)
```

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_distance.py -v`
Expected: 5 passed

- [ ] **Step 5: Write the failing test for the trace recorder**

`backend/tests/test_trace.py`:

```python
from app.algorithms.trace import TraceRecorder


def test_recorder_starts_all_unassigned():
    rec = TraceRecorder(n_points=4)
    assert rec.labels == [-1, -1, -1, -1]


def test_record_applies_delta_to_live_labels():
    rec = TraceRecorder(n_points=3)
    rec.record("assign", "point 0 joins cluster 0", labels_delta={0: 0})
    rec.record("assign", "point 2 joins cluster 1", labels_delta={2: 1})
    assert rec.labels == [0, -1, 1]


def test_replaying_deltas_reproduces_final_labels():
    rec = TraceRecorder(n_points=5)
    for i in range(5):
        rec.record("assign", f"point {i}", labels_delta={i: i % 2})
    trace = rec.finish()

    replayed = [-1] * 5
    for step in trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
    assert replayed == rec.labels


def test_keyframes_agree_with_accumulated_state():
    rec = TraceRecorder(n_points=200, keyframe_every=10)
    for i in range(200):
        rec.record("assign", f"point {i}", labels_delta={i: 0})
    trace = rec.finish()

    replayed = [-1] * 200
    for step in trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
        if step["labels_snapshot"] is not None:
            assert step["labels_snapshot"] == replayed


def test_disabled_recorder_tracks_labels_but_emits_no_steps():
    rec = TraceRecorder(n_points=3, enabled=False)
    rec.record("assign", "point 0", labels_delta={0: 0})
    trace = rec.finish()
    assert rec.labels == [0, -1, -1]
    assert trace["steps"] == []


def test_compaction_respects_budget_and_preserves_final_state():
    rec = TraceRecorder(n_points=50, max_steps=20)
    for i in range(400):
        rec.record("tick", f"step {i}", labels_delta={i % 50: i % 3})
    trace = rec.finish()

    assert trace["truncated"] is True
    assert trace["sample_rate"] > 1
    assert len(trace["steps"]) <= 40

    replayed = [-1] * 50
    for step in trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
    assert replayed == rec.labels


def test_significant_steps_survive_compaction():
    rec = TraceRecorder(n_points=10, max_steps=8)
    for i in range(200):
        rec.record("tick", f"step {i}", labels_delta={i % 10: 0}, significant=(i % 50 == 0))
    trace = rec.finish()
    kinds = [s["kind"] for s in trace["steps"]]
    assert kinds.count("tick") >= 1
    significant_narrations = [s["narration"] for s in trace["steps"] if s["significant"]]
    assert len(significant_narrations) == 4


def test_keyframes_stay_consistent_after_compaction():
    """Compaction and keyframing interact: compaction renumbers the step list,
    and keyframes are assigned afterwards from the renumbered result. Exercise
    both at once with a tight budget and a tight keyframe interval."""
    rec = TraceRecorder(n_points=30, max_steps=16, keyframe_every=5)
    for i in range(300):
        rec.record("tick", f"step {i}", labels_delta={i % 30: i % 4})
    trace = rec.finish()

    assert trace["truncated"] is True

    replayed = [-1] * 30
    snapshots_seen = 0
    for step in trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
        if step["labels_snapshot"] is not None:
            snapshots_seen += 1
            assert step["labels_snapshot"] == replayed
    assert snapshots_seen > 0
    assert replayed == rec.labels


def test_step_indices_are_contiguous_after_compaction():
    rec = TraceRecorder(n_points=10, max_steps=8)
    for i in range(100):
        rec.record("tick", f"step {i}", labels_delta={i % 10: 0})
    trace = rec.finish()
    assert [s["i"] for s in trace["steps"]] == list(range(len(trace["steps"])))
```

- [ ] **Step 6: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_trace.py -v`
Expected: FAIL — no module named `app.algorithms.trace`

- [ ] **Step 7: Implement `backend/app/algorithms/trace.py`**

```python
"""The execution-trace machinery shared by all three algorithms.

An algorithm reports what it is doing by calling ``TraceRecorder.record`` as it
runs. The recorder keeps the running label assignment (so the algorithm never
maintains it separately) and, when tracing is enabled, buffers a replayable list
of steps that the frontend animates.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Step:
    """One recorded moment in an algorithm's execution."""

    i: int
    kind: str
    narration: str
    labels_delta: dict[int, int] = field(default_factory=dict)
    payload: dict[str, Any] = field(default_factory=dict)
    significant: bool = False
    labels_snapshot: list[int] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialise for JSON transport, with delta keys as strings."""
        return {
            "i": self.i,
            "kind": self.kind,
            "narration": self.narration,
            "labels_delta": {str(k): v for k, v in self.labels_delta.items()},
            "payload": self.payload,
            "significant": self.significant,
            "labels_snapshot": self.labels_snapshot,
        }


@dataclass
class ClusterResult:
    """What every algorithm returns."""

    labels: list[int]
    extras: dict[str, Any] = field(default_factory=dict)
    trace: dict[str, Any] = field(default_factory=dict)


class TraceRecorder:
    """Accumulates label state and, optionally, a replayable step list."""

    def __init__(
        self,
        n_points: int,
        enabled: bool = True,
        max_steps: int = 5000,
        keyframe_every: int = 50,
    ) -> None:
        self._labels = [-1] * n_points
        self._enabled = enabled
        self._max_steps = max(1, max_steps)
        self._keyframe_every = max(1, keyframe_every)
        self._steps: list[Step] = []
        self._sample_rate = 1
        self._truncated = False

    @property
    def labels(self) -> list[int]:
        """The current label assignment. Always correct, tracing or not."""
        return self._labels

    def record(
        self,
        kind: str,
        narration: str,
        labels_delta: dict[int, int] | None = None,
        payload: dict[str, Any] | None = None,
        significant: bool = False,
    ) -> None:
        """Apply a label delta and, if enabled, buffer a step describing it."""
        delta = labels_delta or {}
        for idx, label in delta.items():
            self._labels[idx] = label

        if not self._enabled:
            return

        self._steps.append(
            Step(
                i=len(self._steps),
                kind=kind,
                narration=narration,
                labels_delta=dict(delta),
                payload=payload or {},
                significant=significant,
            )
        )
        if len(self._steps) > 2 * self._max_steps:
            self._compact()

    def _compact(self) -> None:
        """Halve the buffer by merging adjacent non-significant step pairs.

        The merged step represents the state after the *later* of the two, so its
        narration and payload win and the deltas combine with the later value
        taking precedence. Significant steps are never merged away.
        """
        merged: list[Step] = []
        i = 0
        while i < len(self._steps):
            current = self._steps[i]
            can_merge = (
                i + 1 < len(self._steps)
                and not current.significant
                and not self._steps[i + 1].significant
            )
            if can_merge:
                nxt = self._steps[i + 1]
                combined = dict(current.labels_delta)
                combined.update(nxt.labels_delta)
                nxt.labels_delta = combined
                merged.append(nxt)
                i += 2
            else:
                merged.append(current)
                i += 1

        if len(merged) == len(self._steps):
            # Every step is significant; growing the buffer beats losing correctness.
            return

        self._steps = merged
        self._sample_rate *= 2
        self._truncated = True

    def finish(self) -> dict[str, Any]:
        """Renumber steps, attach keyframes, and serialise the trace."""
        for position, step in enumerate(self._steps):
            step.i = position

        replayed = [-1] * len(self._labels)
        for step in self._steps:
            for idx, label in step.labels_delta.items():
                replayed[idx] = label
            step.labels_snapshot = (
                list(replayed) if step.i % self._keyframe_every == 0 else None
            )

        return {
            "steps": [step.to_dict() for step in self._steps],
            "truncated": self._truncated,
            "sample_rate": self._sample_rate,
        }
```

Also create an empty `backend/app/algorithms/__init__.py`.

- [ ] **Step 8: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: all passed

- [ ] **Step 9: Commit**

```bash
git add backend/app/algorithms backend/tests/test_trace.py backend/tests/test_distance.py
git commit -m "feat: add trace recorder and distance utilities"
```

---

## Task 3: Dataset generators

**Files:**
- Create: `backend/app/data/__init__.py`, `backend/app/data/generators.py`
- Test: `backend/tests/test_generators.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `GENERATORS: dict[str, dict]` — each value has `key`, `label`, `hint` (one line on what it demonstrates), and `supports_noise: bool`.
  - `generate(kind: str, n_samples: int = 300, noise: float = 0.05, random_seed: int = 42) -> tuple[np.ndarray, np.ndarray]` returning `(points, ground_truth_labels)`. Raises `ValueError` for an unknown kind.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_generators.py`:

```python
import numpy as np
import pytest

from app.data.generators import GENERATORS, generate


@pytest.mark.parametrize("kind", list(GENERATORS))
def test_every_generator_returns_matching_shapes(kind):
    points, labels = generate(kind, n_samples=120, noise=0.05, random_seed=7)
    assert points.shape == (120, 2)
    assert labels.shape == (120,)
    assert points.dtype == np.float64
    assert np.all(np.isfinite(points))


@pytest.mark.parametrize("kind", list(GENERATORS))
def test_generators_are_deterministic(kind):
    a, la = generate(kind, n_samples=60, random_seed=3)
    b, lb = generate(kind, n_samples=60, random_seed=3)
    assert np.array_equal(a, b)
    assert np.array_equal(la, lb)


@pytest.mark.parametrize("kind", list(GENERATORS))
def test_different_seeds_give_different_data(kind):
    a, _ = generate(kind, n_samples=60, random_seed=1)
    b, _ = generate(kind, n_samples=60, random_seed=2)
    assert not np.array_equal(a, b)


def test_blobs_are_well_separated():
    points, labels = generate("blobs", n_samples=300, noise=0.02, random_seed=0)
    assert len(np.unique(labels)) == 3
    centroids = np.array([points[labels == k].mean(axis=0) for k in range(3)])
    # Spread is the mean radial distance from a cluster's own centroid. Using
    # `.std()` on the raw (n, 2) block would flatten x and y together, so a blob
    # whose x-mean and y-mean differ would report the gap between its own axes
    # as "spread" — a number several times its actual tightness.
    spreads = np.array([
        np.linalg.norm(points[labels == k] - centroids[k], axis=1).mean()
        for k in range(3)
    ])
    pairwise = [
        np.linalg.norm(centroids[i] - centroids[j])
        for i in range(3)
        for j in range(i + 1, 3)
    ]
    assert min(pairwise) > 3 * spreads.max()


def test_moons_produce_two_interleaving_groups():
    points, labels = generate("moons", n_samples=200, noise=0.03, random_seed=0)
    assert set(np.unique(labels)) == {0, 1}
    # The moons overlap along x, which is exactly why centroid methods fail on them.
    x0 = points[labels == 0][:, 0]
    x1 = points[labels == 1][:, 0]
    assert x0.max() > x1.min()


def test_uniform_noise_has_a_single_label():
    _, labels = generate("uniform_noise", n_samples=100, random_seed=0)
    assert set(np.unique(labels)) == {0}


def test_every_generator_has_metadata():
    for key, meta in GENERATORS.items():
        assert meta["key"] == key
        assert meta["label"]
        assert meta["hint"]


def test_unknown_generator_is_rejected():
    with pytest.raises(ValueError):
        generate("spirals", n_samples=10)


def test_n_samples_is_respected_even_when_not_divisible():
    points, labels = generate("blobs", n_samples=101, random_seed=0)
    assert points.shape[0] == 101
    assert labels.shape[0] == 101
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_generators.py -v`
Expected: FAIL — no module named `app.data.generators`

- [ ] **Step 3: Implement `backend/app/data/generators.py`**

```python
"""Synthetic datasets, chosen so each one breaks a different algorithm."""

import numpy as np

GENERATORS: dict[str, dict[str, object]] = {
    "blobs": {
        "key": "blobs",
        "label": "Gaussian blobs",
        "hint": "The easy case. All three algorithms should agree here.",
        "supports_noise": True,
    },
    "moons": {
        "key": "moons",
        "label": "Two moons",
        "hint": "Non-convex. DBSCAN nails it; BIRCH and CURE struggle.",
        "supports_noise": True,
    },
    "circles": {
        "key": "circles",
        "label": "Concentric circles",
        "hint": "Nested shapes with a shared centroid — fatal for centroid methods.",
        "supports_noise": True,
    },
    "anisotropic": {
        "key": "anisotropic",
        "label": "Anisotropic blobs",
        "hint": "Stretched diagonally. Shows why CURE uses multiple representatives.",
        "supports_noise": True,
    },
    "varied_density": {
        "key": "varied_density",
        "label": "Varied density",
        "hint": "One eps cannot fit all three densities — DBSCAN's core weakness.",
        "supports_noise": True,
    },
    "uneven_blobs": {
        "key": "uneven_blobs",
        "label": "Uneven blob sizes",
        "hint": "A huge cluster beside two tiny ones. BIRCH's threshold gets awkward.",
        "supports_noise": True,
    },
    "uniform_noise": {
        "key": "uniform_noise",
        "label": "Uniform noise",
        "hint": "No structure at all. A good sanity check: does it invent clusters?",
        "supports_noise": False,
    },
}


def _split_counts(n_samples: int, groups: int) -> list[int]:
    """Divide n_samples into `groups` parts, giving the remainder to the first."""
    base = n_samples // groups
    counts = [base] * groups
    for i in range(n_samples - base * groups):
        counts[i] += 1
    return counts


def _blobs(
    rng: np.random.Generator,
    n_samples: int,
    noise: float,
    centers: list[tuple[float, float]],
    scales: list[float],
) -> tuple[np.ndarray, np.ndarray]:
    """Build Gaussian blobs at the given centres, returning (points, labels)."""
    counts = _split_counts(n_samples, len(centers))
    chunks, labels = [], []
    for k, (center, scale, count) in enumerate(zip(centers, scales, counts)):
        chunks.append(rng.normal(loc=center, scale=scale, size=(count, 2)))
        labels.append(np.full(count, k))
    points = np.vstack(chunks) + rng.normal(scale=noise, size=(n_samples, 2))
    return points.astype(np.float64), np.concatenate(labels)


def generate(
    kind: str,
    n_samples: int = 300,
    noise: float = 0.05,
    random_seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """Return (points, ground_truth_labels) for the named dataset.

    Ground-truth labels are for display only; no algorithm ever sees them.
    """
    if kind not in GENERATORS:
        raise ValueError(f"Unknown generator {kind!r}; expected one of {sorted(GENERATORS)}")
    if n_samples < 1:
        raise ValueError("n_samples must be at least 1")

    rng = np.random.default_rng(random_seed)

    if kind == "blobs":
        return _blobs(
            rng, n_samples, noise,
            centers=[(-2.5, -2.0), (2.5, -1.5), (0.0, 2.8)],
            scales=[0.55, 0.55, 0.55],
        )

    if kind == "uneven_blobs":
        counts = _split_counts(n_samples, 10)
        big = sum(counts[:8])
        chunks = [
            rng.normal(loc=(0.0, 0.0), scale=1.6, size=(big, 2)),
            rng.normal(loc=(4.5, 3.5), scale=0.25, size=(counts[8], 2)),
            rng.normal(loc=(-4.5, 3.0), scale=0.25, size=(counts[9], 2)),
        ]
        labels = np.concatenate([
            np.zeros(big, dtype=int),
            np.full(counts[8], 1),
            np.full(counts[9], 2),
        ])
        points = np.vstack(chunks) + rng.normal(scale=noise, size=(n_samples, 2))
        return points.astype(np.float64), labels

    if kind == "varied_density":
        counts = _split_counts(n_samples, 3)
        chunks = [
            rng.normal(loc=(-3.0, 0.0), scale=0.20, size=(counts[0], 2)),
            rng.normal(loc=(0.5, 0.5), scale=0.70, size=(counts[1], 2)),
            rng.normal(loc=(4.0, -0.5), scale=1.60, size=(counts[2], 2)),
        ]
        labels = np.concatenate([np.full(c, k) for k, c in enumerate(counts)])
        points = np.vstack(chunks) + rng.normal(scale=noise, size=(n_samples, 2))
        return points.astype(np.float64), labels

    if kind == "anisotropic":
        points, labels = _blobs(
            rng, n_samples, noise,
            centers=[(-2.0, -2.0), (2.0, -1.0), (0.0, 2.5)],
            scales=[0.6, 0.6, 0.6],
        )
        transform = np.array([[0.7, -0.6], [-0.45, 0.9]])
        return (points @ transform).astype(np.float64), labels

    if kind == "moons":
        half = n_samples // 2
        rest = n_samples - half
        t_outer = np.linspace(0.0, np.pi, half)
        t_inner = np.linspace(0.0, np.pi, rest)
        outer = np.column_stack([np.cos(t_outer), np.sin(t_outer)])
        inner = np.column_stack([1.0 - np.cos(t_inner), 0.5 - np.sin(t_inner)])
        points = np.vstack([outer, inner]) + rng.normal(scale=noise, size=(n_samples, 2))
        labels = np.concatenate([np.zeros(half, dtype=int), np.ones(rest, dtype=int)])
        return (points * 2.5).astype(np.float64), labels

    if kind == "circles":
        half = n_samples // 2
        rest = n_samples - half
        t_outer = rng.uniform(0.0, 2 * np.pi, half)
        t_inner = rng.uniform(0.0, 2 * np.pi, rest)
        outer = np.column_stack([np.cos(t_outer), np.sin(t_outer)]) * 3.0
        inner = np.column_stack([np.cos(t_inner), np.sin(t_inner)]) * 1.3
        points = np.vstack([outer, inner]) + rng.normal(scale=noise * 3, size=(n_samples, 2))
        labels = np.concatenate([np.zeros(half, dtype=int), np.ones(rest, dtype=int)])
        return points.astype(np.float64), labels

    # uniform_noise
    points = rng.uniform(-4.0, 4.0, size=(n_samples, 2))
    return points.astype(np.float64), np.zeros(n_samples, dtype=int)
```

Also create an empty `backend/app/data/__init__.py`.

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_generators.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/data backend/tests/test_generators.py
git commit -m "feat: add synthetic dataset generators"
```

---

## Task 4: Quality metrics

**Files:**
- Create: `backend/app/analysis/__init__.py`, `backend/app/analysis/metrics.py`
- Test: `backend/tests/test_metrics.py`

**Interfaces:**
- Consumes: `pairwise_distances` from `app.algorithms.distance`.
- Produces:
  - `silhouette_score(X: np.ndarray, labels: np.ndarray) -> float | None`
  - `davies_bouldin_score(X: np.ndarray, labels: np.ndarray) -> float | None`
  - `summarize(X: np.ndarray, labels: np.ndarray) -> dict` with keys `n_clusters`, `n_noise`, `cluster_sizes` (dict of str id to int), `silhouette`, `davies_bouldin`.

**Design note:** noise points (label `-1`) are excluded from both scores but counted in `n_noise`. `None` serialises to JSON `null`, and the UI shows a dash rather than a misleading number.

The two scores differ on when they are undefined, and the difference is mathematical, not stylistic:

- **Both** return `None` when fewer than two clusters survive — neither index means anything without at least two groups to compare.
- **Silhouette additionally** returns `None` when any surviving cluster has a single member. Its `a(i)` term is the mean distance to *other* members of the same cluster, which does not exist for a lone point. (Some libraries return 0 for such points; that convention silently drags the mean toward zero, so this project reports "undefined" instead.)
- **Davies-Bouldin does NOT** special-case singletons. A one-member cluster simply has spread 0, and the index stays well-defined and meaningful. Since DBSCAN routinely yields very small clusters, suppressing the score there would throw away a usable number for no reason.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_metrics.py`:

```python
import numpy as np

from app.analysis.metrics import davies_bouldin_score, silhouette_score, summarize


def test_silhouette_is_near_one_for_well_separated_clusters():
    X = np.array([[0.0, 0.0], [0.1, 0.0], [10.0, 10.0], [10.1, 10.0]])
    labels = np.array([0, 0, 1, 1])
    score = silhouette_score(X, labels)
    assert score is not None
    assert score > 0.9


# Points on a line: 0, 1 in cluster 0; 4, 5 in cluster 1. Every point's own
# neighbour sits 1 away, so a = 1 throughout, but b differs by position:
#   point 0 (outer): b = mean(4, 5) = 4.5  ->  s = 3.5 / 4.5
#   point 1 (inner): b = mean(3, 4) = 3.5  ->  s = 2.5 / 3.5
#   point 2 (inner): b = mean(3, 4) = 3.5  ->  s = 2.5 / 3.5
#   point 3 (outer): b = mean(4, 5) = 4.5  ->  s = 3.5 / 4.5
# The outer points score higher than the inner ones. Only the mirror pairs
# agree, so the mean silhouette equals no single point's score.
TINY_FIXTURE_SILHOUETTE = (3.5 / 4.5 + 2.5 / 3.5 + 2.5 / 3.5 + 3.5 / 4.5) / 4


def test_silhouette_hand_computed_on_a_tiny_fixture():
    X = np.array([[0.0], [1.0], [4.0], [5.0]])
    labels = np.array([0, 0, 1, 1])
    assert np.isclose(silhouette_score(X, labels), TINY_FIXTURE_SILHOUETTE)


def test_silhouette_excludes_noise_points():
    # The far-off noise point must not enter either the a or the b term, so the
    # score has to come out identical to the fixture without it.
    X = np.array([[0.0], [1.0], [4.0], [5.0], [100.0]])
    labels = np.array([0, 0, 1, 1, -1])
    assert np.isclose(silhouette_score(X, labels), TINY_FIXTURE_SILHOUETTE)


def test_silhouette_is_none_with_one_cluster():
    X = np.array([[0.0], [1.0], [2.0]])
    assert silhouette_score(X, np.array([0, 0, 0])) is None


def test_silhouette_is_none_when_all_points_are_noise():
    X = np.array([[0.0], [1.0]])
    assert silhouette_score(X, np.array([-1, -1])) is None


def test_silhouette_is_none_for_singleton_cluster():
    X = np.array([[0.0], [1.0], [50.0]])
    assert silhouette_score(X, np.array([0, 0, 1])) is None


def test_davies_bouldin_is_lower_for_better_separation():
    tight = np.array([[0.0], [0.1], [10.0], [10.1]])
    loose = np.array([[0.0], [4.0], [6.0], [10.0]])
    labels = np.array([0, 0, 1, 1])
    assert davies_bouldin_score(tight, labels) < davies_bouldin_score(loose, labels)


def test_davies_bouldin_hand_computed():
    # Cluster 0 at {0, 2} (centroid 1, spread 1); cluster 1 at {8, 10} (centroid 9, spread 1).
    # DB = (S0 + S1) / |c0 - c1| = (1 + 1) / 8 = 0.25
    X = np.array([[0.0], [2.0], [8.0], [10.0]])
    labels = np.array([0, 0, 1, 1])
    assert np.isclose(davies_bouldin_score(X, labels), 0.25)


def test_davies_bouldin_is_none_with_one_cluster():
    X = np.array([[0.0], [1.0]])
    assert davies_bouldin_score(X, np.array([0, 0])) is None


def test_davies_bouldin_is_defined_for_a_singleton_cluster():
    # Unlike silhouette, DB has no undefined term for a lone point: its spread is
    # simply 0. DBSCAN produces small clusters routinely, so suppressing the score
    # here would discard a usable number. This test pins that deliberate difference.
    X = np.array([[0.0], [1.0], [50.0]])
    labels = np.array([0, 0, 1])
    score = davies_bouldin_score(X, labels)
    assert score is not None
    assert np.isfinite(score)
    # Cluster 0 spans [0, 1] (centroid 0.5, spread 0.5); cluster 1 is the lone
    # point at 50 (spread 0). DB = (0.5 + 0) / |0.5 - 50| = 0.5 / 49.5
    assert np.isclose(score, 0.5 / 49.5)


def test_silhouette_and_davies_bouldin_disagree_on_singletons():
    # The contract these two metrics deliberately do not share.
    X = np.array([[0.0], [1.0], [50.0]])
    labels = np.array([0, 0, 1])
    assert silhouette_score(X, labels) is None
    assert davies_bouldin_score(X, labels) is not None


def test_summarize_counts_clusters_and_noise():
    X = np.array([[0.0], [1.0], [4.0], [5.0], [100.0]])
    labels = np.array([0, 0, 1, 1, -1])
    summary = summarize(X, labels)
    assert summary["n_clusters"] == 2
    assert summary["n_noise"] == 1
    assert summary["cluster_sizes"] == {"0": 2, "1": 2}
    assert summary["silhouette"] is not None
    assert summary["davies_bouldin"] is not None


def test_summarize_handles_all_noise_without_dividing_by_zero():
    X = np.array([[0.0], [1.0]])
    summary = summarize(X, np.array([-1, -1]))
    assert summary["n_clusters"] == 0
    assert summary["n_noise"] == 2
    assert summary["cluster_sizes"] == {}
    assert summary["silhouette"] is None
    assert summary["davies_bouldin"] is None


def test_summarize_handles_duplicate_points_without_nan():
    X = np.zeros((6, 2))
    labels = np.array([0, 0, 0, 1, 1, 1])
    summary = summarize(X, labels)
    assert summary["silhouette"] is None or np.isfinite(summary["silhouette"])
    assert summary["davies_bouldin"] is None or np.isfinite(summary["davies_bouldin"])
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_metrics.py -v`
Expected: FAIL — no module named `app.analysis.metrics`

- [ ] **Step 3: Implement `backend/app/analysis/metrics.py`**

```python
"""Clustering-quality metrics, written from scratch.

Noise points (label -1) are excluded from both scores: they are by definition
not members of any cluster, so including them would penalise an algorithm for
correctly identifying outliers.
"""

import numpy as np

from app.algorithms.distance import pairwise_distances


def _clustered_subset(X: np.ndarray, labels: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Drop noise points, returning (points, labels) for clustered points only."""
    mask = labels != -1
    return X[mask], labels[mask]


def silhouette_score(X: np.ndarray, labels: np.ndarray) -> float | None:
    """Mean silhouette coefficient over clustered points, or None if undefined.

    Returns None when fewer than two clusters survive, or when any cluster has a
    single member (its intra-cluster distance is undefined).
    """
    Xc, lc = _clustered_subset(np.asarray(X, dtype=np.float64), np.asarray(labels))
    unique = np.unique(lc)
    if unique.size < 2:
        return None
    if any(np.sum(lc == k) < 2 for k in unique):
        return None

    D = pairwise_distances(Xc)
    scores = np.empty(Xc.shape[0], dtype=np.float64)

    for i in range(Xc.shape[0]):
        own = lc == lc[i]
        own[i] = False
        a = D[i, own].mean()
        b = min(D[i, lc == k].mean() for k in unique if k != lc[i])
        denom = max(a, b)
        scores[i] = 0.0 if denom == 0.0 else (b - a) / denom

    return float(scores.mean())


def davies_bouldin_score(X: np.ndarray, labels: np.ndarray) -> float | None:
    """Davies-Bouldin index over clustered points (lower is better), or None.

    Returns None when fewer than two clusters survive.
    """
    Xc, lc = _clustered_subset(np.asarray(X, dtype=np.float64), np.asarray(labels))
    unique = np.unique(lc)
    if unique.size < 2:
        return None

    centroids = np.array([Xc[lc == k].mean(axis=0) for k in unique])
    spreads = np.array([
        float(np.linalg.norm(Xc[lc == k] - centroids[j], axis=1).mean())
        for j, k in enumerate(unique)
    ])

    worst = []
    for j in range(unique.size):
        ratios = []
        for m in range(unique.size):
            if m == j:
                continue
            separation = float(np.linalg.norm(centroids[j] - centroids[m]))
            if separation == 0.0:
                # Coincident centroids: treat as maximally bad rather than infinite.
                ratios.append(0.0 if spreads[j] + spreads[m] == 0.0 else 1e9)
            else:
                ratios.append((spreads[j] + spreads[m]) / separation)
        worst.append(max(ratios))

    return float(np.mean(worst))


def summarize(X: np.ndarray, labels: np.ndarray) -> dict:
    """Cluster counts, sizes, and both quality scores in one payload."""
    labels = np.asarray(labels)
    unique = [int(k) for k in np.unique(labels) if k != -1]
    return {
        "n_clusters": len(unique),
        "n_noise": int(np.sum(labels == -1)),
        "cluster_sizes": {str(k): int(np.sum(labels == k)) for k in unique},
        "silhouette": silhouette_score(X, labels),
        "davies_bouldin": davies_bouldin_score(X, labels),
    }
```

Also create an empty `backend/app/analysis/__init__.py`.

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_metrics.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/analysis backend/tests/test_metrics.py
git commit -m "feat: add silhouette and davies-bouldin metrics"
```

---

## Task 5: PCA projection and standardisation

**Files:**
- Create: `backend/app/analysis/projection.py`
- Test: `backend/tests/test_projection.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `pca(X: np.ndarray, n_components: int = 2) -> tuple[np.ndarray, np.ndarray]` returning `(projected (n, n_components), explained_variance_ratio (n_components,))`.
  - `standardize(X: np.ndarray) -> np.ndarray` — z-score per column, leaving zero-variance columns untouched.
  - `to_display_2d(X: np.ndarray) -> tuple[np.ndarray, list[float] | None]` — returns X unchanged with `None` ratio when `d == 2`, pads a zero column when `d == 1`, and PCA-projects when `d > 2`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_projection.py`:

```python
import numpy as np

from app.analysis.projection import pca, standardize, to_display_2d


def test_pca_recovers_the_dominant_axis():
    rng = np.random.default_rng(0)
    t = rng.normal(size=200)
    # Variance lives almost entirely along the (1, 1) direction.
    X = np.column_stack([t, t]) + rng.normal(scale=0.01, size=(200, 2))
    projected, ratio = pca(X, n_components=2)
    assert projected.shape == (200, 2)
    assert ratio[0] > 0.99


def test_explained_variance_ratios_sum_to_at_most_one_and_descend():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(100, 5))
    _, ratio = pca(X, n_components=3)
    assert ratio.shape == (3,)
    assert np.all(np.diff(ratio) <= 1e-12)
    assert 0 < ratio.sum() <= 1.0 + 1e-9


def test_pca_output_is_centred():
    rng = np.random.default_rng(2)
    X = rng.normal(loc=50.0, size=(80, 4))
    projected, _ = pca(X, n_components=2)
    assert np.allclose(projected.mean(axis=0), 0.0, atol=1e-8)


def test_pca_preserves_pairwise_distance_ordering_for_planar_data():
    rng = np.random.default_rng(3)
    base = rng.normal(size=(40, 2))
    # Embed a 2D plane in 5D: PCA must recover it losslessly.
    embedding = rng.normal(size=(2, 5))
    X = base @ embedding
    projected, ratio = pca(X, n_components=2)
    assert ratio.sum() > 0.999
    d_original = np.linalg.norm(X[0] - X[1])
    d_projected = np.linalg.norm(projected[0] - projected[1])
    assert np.isclose(d_original, d_projected, rtol=1e-6)


def test_pca_handles_constant_data_without_nan():
    X = np.ones((10, 3))
    projected, ratio = pca(X, n_components=2)
    assert np.all(np.isfinite(projected))
    assert np.all(np.isfinite(ratio))


def test_standardize_gives_unit_variance():
    rng = np.random.default_rng(4)
    X = rng.normal(loc=5.0, scale=3.0, size=(200, 2))
    Z = standardize(X)
    assert np.allclose(Z.mean(axis=0), 0.0, atol=1e-9)
    assert np.allclose(Z.std(axis=0), 1.0, atol=1e-9)


def test_standardize_leaves_constant_columns_finite():
    X = np.column_stack([np.ones(10), np.arange(10.0)])
    Z = standardize(X)
    assert np.all(np.isfinite(Z))
    assert np.allclose(Z[:, 0], 0.0)


def test_to_display_2d_passes_through_two_dimensional_data():
    X = np.array([[1.0, 2.0], [3.0, 4.0]])
    shown, ratio = to_display_2d(X)
    assert np.array_equal(shown, X)
    assert ratio is None


def test_to_display_2d_pads_one_dimensional_data():
    X = np.array([[1.0], [3.0]])
    shown, ratio = to_display_2d(X)
    assert shown.shape == (2, 2)
    assert np.allclose(shown[:, 1], 0.0)
    assert ratio is None


def test_to_display_2d_projects_high_dimensional_data():
    rng = np.random.default_rng(5)
    X = rng.normal(size=(50, 7))
    shown, ratio = to_display_2d(X)
    assert shown.shape == (50, 2)
    assert ratio is not None and len(ratio) == 2
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_projection.py -v`
Expected: FAIL — no module named `app.analysis.projection`

- [ ] **Step 3: Implement `backend/app/analysis/projection.py`**

```python
"""PCA and feature scaling, used only to display data — never to cluster it."""

import numpy as np


def standardize(X: np.ndarray) -> np.ndarray:
    """Z-score each column. Zero-variance columns become zeros rather than NaN."""
    X = np.asarray(X, dtype=np.float64)
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    safe_std = np.where(std == 0.0, 1.0, std)
    return (X - mean) / safe_std


def pca(X: np.ndarray, n_components: int = 2) -> tuple[np.ndarray, np.ndarray]:
    """Project X onto its top principal components via the SVD of the centred data.

    Returns (projected, explained_variance_ratio). Components are ordered by
    descending variance. When the data has no variance at all, the ratio is
    reported as zeros rather than NaN.
    """
    X = np.asarray(X, dtype=np.float64)
    n_components = max(1, min(n_components, X.shape[1]))

    centred = X - X.mean(axis=0)
    # full_matrices=False keeps this cheap for tall matrices.
    U, S, Vt = np.linalg.svd(centred, full_matrices=False)

    projected = centred @ Vt[:n_components].T

    variances = (S**2) / max(1, X.shape[0] - 1)
    total = variances.sum()
    ratio = (
        np.zeros(n_components, dtype=np.float64)
        if total <= 0.0
        else variances[:n_components] / total
    )
    return projected, ratio


def to_display_2d(X: np.ndarray) -> tuple[np.ndarray, list[float] | None]:
    """Return 2D coordinates suitable for the scatter plot.

    2D data passes through untouched, 1D data gains a zero second axis, and
    higher-dimensional data is PCA-projected. The explained-variance ratio is
    returned only when a projection actually happened, so the UI can tell the
    user how much of the structure they are not seeing.
    """
    X = np.asarray(X, dtype=np.float64)
    d = X.shape[1]
    if d == 2:
        return X, None
    if d == 1:
        return np.column_stack([X[:, 0], np.zeros(X.shape[0])]), None
    projected, ratio = pca(X, n_components=2)
    return projected, [float(v) for v in ratio]
```

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_projection.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/analysis/projection.py backend/tests/test_projection.py
git commit -m "feat: add PCA projection and standardisation"
```

---

## Task 6: DBSCAN

**Files:**
- Create: `backend/app/algorithms/dbscan.py`
- Test: `backend/tests/test_dbscan.py`

**Interfaces:**
- Consumes: `TraceRecorder`, `ClusterResult` from `app.algorithms.trace`; `distances_to` from `app.algorithms.distance`.
- Produces: `dbscan(X: np.ndarray, eps: float, min_pts: int, metric: str = "euclidean", record_trace: bool = True, max_steps: int = 5000) -> ClusterResult`.
  - `extras` contains `point_types: list[str]` with one of `"core"`, `"border"`, `"noise"` per point.
  - Step kinds emitted: `visit`, `core`, `noise`, `expand`, `border`, `done`.

**Design note:** `min_pts` counts the point itself, matching the original paper. A point is *core* if its eps-neighbourhood (inclusive) has at least `min_pts` members. Border points are non-core points reachable from a core point; they join the first cluster that reaches them. Points are visited in index order so the output is deterministic.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_dbscan.py`:

```python
import numpy as np
import pytest

from app.algorithms.dbscan import dbscan
from app.data.generators import generate


def brute_force_dbscan(X, eps, min_pts):
    """An independent reference implementation, deliberately written the slow,
    obvious way so it cannot share a bug with the optimised version."""
    n = len(X)
    neighbours = [
        [j for j in range(n) if np.linalg.norm(X[i] - X[j]) <= eps] for i in range(n)
    ]
    labels = [-1] * n
    visited = [False] * n
    cluster = 0
    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True
        if len(neighbours[i]) < min_pts:
            continue
        labels[i] = cluster
        queue = [j for j in neighbours[i] if j != i]
        while queue:
            j = queue.pop(0)
            if not visited[j]:
                visited[j] = True
                if len(neighbours[j]) >= min_pts:
                    queue.extend(k for k in neighbours[j] if k not in queue)
            if labels[j] == -1:
                labels[j] = cluster
        cluster += 1
    return labels


def agreement(a, b):
    """Fraction of point pairs that both labelings agree to co-cluster or not."""
    a, b = np.asarray(a), np.asarray(b)
    n = len(a)
    same_a = a[:, None] == a[None, :]
    same_b = b[:, None] == b[None, :]
    return float((same_a == same_b).sum() - n) / (n * n - n)


def test_recovers_well_separated_blobs():
    X, truth = generate("blobs", n_samples=180, noise=0.02, random_seed=0)
    result = dbscan(X, eps=0.9, min_pts=5, record_trace=False)
    assert agreement(result.labels, truth) > 0.95


def test_separates_the_two_moons():
    X, truth = generate("moons", n_samples=200, noise=0.02, random_seed=0)
    result = dbscan(X, eps=0.4, min_pts=5, record_trace=False)
    assert agreement(result.labels, truth) > 0.9


@pytest.mark.parametrize("seed", [0, 1, 2, 3, 4])
def test_matches_brute_force_reference_on_random_data(seed):
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(60, 2))
    expected = brute_force_dbscan(X, eps=0.6, min_pts=4)
    actual = dbscan(X, eps=0.6, min_pts=4, record_trace=False).labels
    # Cluster ids may differ; the partition must not.
    assert agreement(actual, expected) == 1.0
    assert [l == -1 for l in actual] == [l == -1 for l in expected]


def test_large_eps_merges_everything_into_one_cluster():
    X, _ = generate("blobs", n_samples=90, random_seed=0)
    result = dbscan(X, eps=100.0, min_pts=3, record_trace=False)
    assert set(result.labels) == {0}


def test_tiny_eps_marks_everything_noise():
    X, _ = generate("blobs", n_samples=90, random_seed=0)
    result = dbscan(X, eps=1e-9, min_pts=3, record_trace=False)
    assert set(result.labels) == {-1}
    assert set(result.extras["point_types"]) == {"noise"}


def test_point_types_are_classified():
    X, _ = generate("blobs", n_samples=150, noise=0.02, random_seed=0)
    result = dbscan(X, eps=0.6, min_pts=6, record_trace=False)
    types = result.extras["point_types"]
    assert len(types) == 150
    assert set(types) <= {"core", "border", "noise"}
    assert "core" in types


def test_trace_replay_reproduces_final_labels():
    X, _ = generate("blobs", n_samples=100, random_seed=0)
    result = dbscan(X, eps=0.8, min_pts=5, record_trace=True)
    replayed = [-1] * 100
    for step in result.trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
    assert replayed == result.labels


def test_trace_narrations_are_non_empty_and_payloads_are_drawable():
    X, _ = generate("blobs", n_samples=60, random_seed=0)
    result = dbscan(X, eps=0.8, min_pts=5, record_trace=True)
    steps = result.trace["steps"]
    assert len(steps) > 0
    assert all(step["narration"] for step in steps)
    visits = [s for s in steps if s["kind"] == "visit"]
    assert visits and "eps_circle" in visits[0]["payload"]
    assert "neighbors" in visits[0]["payload"]


def test_manhattan_metric_runs_and_differs_from_euclidean():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(60, 2))
    a = dbscan(X, eps=0.6, min_pts=4, metric="euclidean", record_trace=False).labels
    b = dbscan(X, eps=0.6, min_pts=4, metric="manhattan", record_trace=False).labels
    assert len(a) == len(b) == 60
    assert a != b


def test_single_point_is_noise_unless_min_pts_is_one():
    X = np.array([[0.0, 0.0]])
    assert dbscan(X, eps=1.0, min_pts=2, record_trace=False).labels == [-1]
    assert dbscan(X, eps=1.0, min_pts=1, record_trace=False).labels == [0]


def test_duplicate_points_form_one_cluster():
    X = np.zeros((10, 2))
    result = dbscan(X, eps=0.5, min_pts=3, record_trace=False)
    assert set(result.labels) == {0}


def test_invalid_parameters_are_rejected():
    X = np.zeros((5, 2))
    with pytest.raises(ValueError):
        dbscan(X, eps=0.0, min_pts=3)
    with pytest.raises(ValueError):
        dbscan(X, eps=1.0, min_pts=0)
    with pytest.raises(ValueError):
        dbscan(np.zeros((0, 2)), eps=1.0, min_pts=3)
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_dbscan.py -v`
Expected: FAIL — no module named `app.algorithms.dbscan`

- [ ] **Step 3: Implement `backend/app/algorithms/dbscan.py`**

```python
"""DBSCAN — density-based clustering with explicit noise.

The neighbourhood of a point includes the point itself, so `min_pts` counts it,
matching Ester et al. (1996). Points are visited in index order, which makes the
cluster numbering and the recorded trace fully reproducible.
"""

import numpy as np

from app.algorithms.distance import distances_to
from app.algorithms.trace import ClusterResult, TraceRecorder


def dbscan(
    X: np.ndarray,
    eps: float,
    min_pts: int,
    metric: str = "euclidean",
    record_trace: bool = True,
    max_steps: int = 5000,
) -> ClusterResult:
    """Cluster X by density reachability.

    Returns a ClusterResult whose extras carry `point_types`, one of "core",
    "border", or "noise" for every point.
    """
    X = np.asarray(X, dtype=np.float64)
    if X.ndim != 2 or X.shape[0] == 0:
        raise ValueError("X must be a non-empty 2-D array of shape (n, d)")
    if eps <= 0:
        raise ValueError("eps must be greater than 0")
    if min_pts < 1:
        raise ValueError("min_pts must be at least 1")

    n = X.shape[0]
    rec = TraceRecorder(n, enabled=record_trace, max_steps=max_steps)

    # Precompute neighbourhoods once; every later lookup is a list index.
    neighbourhoods: list[np.ndarray] = [
        np.flatnonzero(distances_to(X, X[i], metric) <= eps) for i in range(n)
    ]
    is_core = np.array([len(neighbourhoods[i]) >= min_pts for i in range(n)])

    point_types = ["noise"] * n
    visited = np.zeros(n, dtype=bool)
    cluster_id = 0

    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True
        neighbours = neighbourhoods[i]

        rec.record(
            "visit",
            f"Visiting point {i}: {len(neighbours)} neighbour(s) within eps={eps:g}.",
            payload={
                "point": i,
                "eps_circle": {"center": X[i].tolist(), "radius": eps},
                "neighbors": neighbours.tolist(),
                "cluster_id": cluster_id,
            },
        )

        if not is_core[i]:
            rec.record(
                "noise",
                f"Point {i} has {len(neighbours)} neighbour(s), fewer than minPts="
                f"{min_pts}, so it is marked noise for now.",
                payload={"point": i},
            )
            continue

        point_types[i] = "core"
        rec.record(
            "core",
            f"Point {i} has {len(neighbours)} neighbour(s) (>= minPts={min_pts}), "
            f"so it is a core point and starts cluster {cluster_id}.",
            labels_delta={i: cluster_id},
            payload={
                "point": i,
                "cluster_id": cluster_id,
                "eps_circle": {"center": X[i].tolist(), "radius": eps},
            },
            significant=True,
        )

        queue: list[int] = [int(j) for j in neighbours if j != i]
        in_queue = set(queue)

        while queue:
            j = queue.pop(0)
            in_queue.discard(j)
            delta: dict[int, int] = {}

            if not visited[j]:
                visited[j] = True
                if is_core[j]:
                    point_types[j] = "core"
                    # Re-queue a neighbour when it is unvisited (it may be core and
                    # extend the frontier) OR when it is visited but still
                    # unassigned. That second case is the border point the outer
                    # scan already passed over and provisionally called noise: this
                    # cluster reaches it, so it must be able to claim it. Filtering
                    # on `not visited[k]` alone strands those points as noise
                    # forever, which the brute-force reference test catches.
                    # Points already in a cluster are skipped — border points
                    # belong to the first cluster that reaches them.
                    fresh = [
                        int(k)
                        for k in neighbourhoods[j]
                        if k not in in_queue and (not visited[k] or rec.labels[k] == -1)
                    ]
                    queue.extend(fresh)
                    in_queue.update(fresh)
                elif point_types[j] == "noise":
                    point_types[j] = "border"

            if rec.labels[j] == -1:
                delta[j] = cluster_id
                if not is_core[j]:
                    point_types[j] = "border"

            role = point_types[j]
            rec.record(
                "expand" if is_core[j] else "border",
                f"Point {j} is reachable from cluster {cluster_id} and is a "
                f"{role} point; the frontier now holds {len(queue)} point(s).",
                labels_delta=delta,
                payload={
                    "point": j,
                    "cluster_id": cluster_id,
                    "eps_circle": {"center": X[j].tolist(), "radius": eps},
                    "neighbors": neighbourhoods[j].tolist() if is_core[j] else [],
                    "queue": list(queue),
                },
            )

        cluster_id += 1

    n_noise = sum(1 for label in rec.labels if label == -1)
    rec.record(
        "done",
        f"Finished: {cluster_id} cluster(s) and {n_noise} noise point(s).",
        payload={"n_clusters": cluster_id, "n_noise": n_noise},
        significant=True,
    )

    return ClusterResult(
        labels=list(rec.labels),
        extras={"point_types": point_types},
        trace=rec.finish(),
    )
```

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_dbscan.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/algorithms/dbscan.py backend/tests/test_dbscan.py
git commit -m "feat: implement DBSCAN with execution trace"
```

---

## Task 7: BIRCH and the CF-tree

**Files:**
- Create: `backend/app/algorithms/birch.py`
- Test: `backend/tests/test_birch.py`

**Interfaces:**
- Consumes: `TraceRecorder`, `ClusterResult` from `app.algorithms.trace`.
- Produces:
  - `CFEntry` with `n: int`, `ls: np.ndarray`, `ss: float`, `child: CFNode | None`, `members: list[int]`, and properties `centroid -> np.ndarray`, `radius -> float`; methods `absorb(point, index)`, `merge(other)`, `radius_if_absorbed(point) -> float`.
  - `CFNode` with `is_leaf: bool`, `entries: list[CFEntry]`, `node_id: int`.
  - `CFTree(threshold: float, branching_factor: int, n_features: int)` with `.insert(point: np.ndarray, index: int) -> list[int]` returning the traversed node-id path, `.leaf_entries() -> list[CFEntry]`, `.serialize() -> dict`.
  - `birch(X, threshold=0.5, branching_factor=50, n_clusters=None, record_trace=True, max_steps=5000) -> ClusterResult`, with `extras["cf_tree"]` holding the final serialised tree and `extras["n_leaf_entries"]`.
  - Step kinds emitted: `absorb`, `new_entry`, `split`, `global_cluster`, `done`. (An insertion reports itself as either `absorb` or `new_entry` — those two ARE the insert step, distinguished by whether the point fitted an existing entry. There is deliberately no separate `insert` kind.)

**Design note on the CF vector:** an entry stores `n` (count), `ls` (vector sum), and `ss` (scalar sum of squared magnitudes, i.e. `sum over members of ||x||^2`). The centroid is `ls / n`; the radius is `sqrt(max(0, ss/n - ||ls/n||^2))`. Storing `ss` as a scalar rather than a vector is the standard formulation and is all the radius needs. Two CFs merge by adding their components — that additivity is what makes BIRCH work, and it has its own test.

**Serialisation shape** (consumed by `CFTreeView` on the frontend):

```json
{"nodes": [{"id": 0, "parent": null, "is_leaf": false,
            "entries": [{"n": 40, "centroid": [1.2, 0.4], "radius": 0.31, "child": 1}]}],
 "root": 0}
```

- [ ] **Step 1: Write the failing test**

`backend/tests/test_birch.py`:

```python
import numpy as np
import pytest

from app.algorithms.birch import CFEntry, CFTree, birch
from app.data.generators import generate


def agreement(a, b):
    a, b = np.asarray(a), np.asarray(b)
    n = len(a)
    same_a = a[:, None] == a[None, :]
    same_b = b[:, None] == b[None, :]
    return float((same_a == same_b).sum() - n) / (n * n - n)


def test_cf_entry_centroid_and_radius():
    entry = CFEntry(n_features=2)
    for i, point in enumerate([np.array([0.0, 0.0]), np.array([2.0, 0.0])]):
        entry.absorb(point, i)
    assert np.allclose(entry.centroid, [1.0, 0.0])
    # ss/n - ||centroid||^2 = (0 + 4)/2 - 1 = 1
    assert np.isclose(entry.radius, 1.0)


def test_cf_additivity():
    """Merging two CFs must equal the CF of the union. This is BIRCH's foundation."""
    rng = np.random.default_rng(0)
    points = rng.normal(size=(10, 3))

    left = CFEntry(n_features=3)
    right = CFEntry(n_features=3)
    union = CFEntry(n_features=3)
    for i, p in enumerate(points[:4]):
        left.absorb(p, i)
        union.absorb(p, i)
    for i, p in enumerate(points[4:], start=4):
        right.absorb(p, i)
        union.absorb(p, i)

    left.merge(right)
    assert left.n == union.n
    assert np.allclose(left.ls, union.ls)
    assert np.isclose(left.ss, union.ss)
    assert np.allclose(left.centroid, union.centroid)
    assert np.isclose(left.radius, union.radius)


def test_radius_if_absorbed_matches_actually_absorbing():
    rng = np.random.default_rng(1)
    entry = CFEntry(n_features=2)
    for i, p in enumerate(rng.normal(size=(5, 2))):
        entry.absorb(p, i)
    candidate = np.array([1.0, 1.0])
    predicted = entry.radius_if_absorbed(candidate)
    entry.absorb(candidate, 99)
    assert np.isclose(predicted, entry.radius)


def test_no_leaf_entry_exceeds_the_threshold():
    X, _ = generate("blobs", n_samples=200, random_seed=0)
    tree = CFTree(threshold=0.5, branching_factor=6, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)
    for entry in tree.leaf_entries():
        assert entry.radius <= 0.5 + 1e-9


def test_no_node_exceeds_the_branching_factor():
    X, _ = generate("blobs", n_samples=200, random_seed=0)
    tree = CFTree(threshold=0.3, branching_factor=4, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)
    serialised = tree.serialize()
    for node in serialised["nodes"]:
        assert len(node["entries"]) <= 4


def test_every_point_lands_in_exactly_one_leaf_entry():
    X, _ = generate("blobs", n_samples=150, random_seed=0)
    tree = CFTree(threshold=0.4, branching_factor=5, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)
    seen = [idx for entry in tree.leaf_entries() for idx in entry.members]
    assert sorted(seen) == list(range(150))


def test_insert_returns_a_path_from_root_to_leaf():
    X, _ = generate("blobs", n_samples=60, random_seed=0)
    tree = CFTree(threshold=0.3, branching_factor=3, n_features=2)
    path = None
    for i, point in enumerate(X):
        path = tree.insert(point, i)
    assert path is not None and len(path) >= 1
    assert path[0] == tree.root.node_id


def test_serialized_tree_has_consistent_parent_links():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    tree = CFTree(threshold=0.3, branching_factor=3, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)
    serialised = tree.serialize()
    ids = {node["id"] for node in serialised["nodes"]}
    for node in serialised["nodes"]:
        if node["id"] == serialised["root"]:
            assert node["parent"] is None
        else:
            assert node["parent"] in ids


def test_birch_recovers_well_separated_blobs():
    X, truth = generate("blobs", n_samples=210, noise=0.02, random_seed=0)
    result = birch(X, threshold=0.4, branching_factor=8, n_clusters=3, record_trace=False)
    assert agreement(result.labels, truth) > 0.95


def test_birch_without_n_clusters_uses_leaf_entries_directly():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    result = birch(X, threshold=0.6, branching_factor=8, n_clusters=None, record_trace=False)
    assert len(set(result.labels)) == result.extras["n_leaf_entries"]


def test_birch_assigns_every_point():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    result = birch(X, threshold=0.5, branching_factor=6, n_clusters=3, record_trace=False)
    assert len(result.labels) == 120
    assert -1 not in result.labels


def test_cf_tree_is_byte_identical_across_repeated_runs():
    """Node ids must be numbered per tree, not from a module-level counter.

    The backend is a long-lived uvicorn server, so a process-global counter would
    give two identical requests different node ids — `extras["cf_tree"]` and every
    trace `path`/`split_nodes` payload would differ between runs even though the
    clustering is identical. Comparing `.labels` alone would not catch it.
    """
    X, _ = generate("blobs", n_samples=90, random_seed=0)
    first = birch(X, threshold=0.4, branching_factor=3, n_clusters=3, record_trace=False)
    second = birch(X, threshold=0.4, branching_factor=3, n_clusters=3, record_trace=False)
    assert first.labels == second.labels
    assert first.extras["cf_tree"] == second.extras["cf_tree"]


def test_non_leaf_entries_summarise_their_descendant_leaves():
    """Ancestor CFs must stay in sync with the leaves beneath them.

    `_update_path_statistics` and `_split`'s `copy_stats_from` calls jointly
    maintain this, and the arrangement is subtle: after a split the path walk
    starts from an orphaned node and no-ops for the levels that were themselves
    split, relying on the split having already baked in correct totals. Nothing
    else in this suite would catch that going stale after a refactor.
    A branching factor of 2 forces repeated cascading splits through the root.
    """
    X, _ = generate("blobs", n_samples=150, random_seed=0)
    tree = CFTree(threshold=0.25, branching_factor=2, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)

    def leaves_under(node):
        if node.is_leaf:
            return list(node.entries)
        return [
            leaf
            for entry in node.entries
            if entry.child is not None
            for leaf in leaves_under(entry.child)
        ]

    checked = 0
    stack = [tree.root]
    while stack:
        node = stack.pop()
        if node.is_leaf:
            continue
        for entry in node.entries:
            if entry.child is None:
                continue
            descendants = leaves_under(entry.child)
            assert entry.n == sum(d.n for d in descendants)
            assert np.allclose(entry.ls, np.sum([d.ls for d in descendants], axis=0))
            assert np.isclose(entry.ss, sum(d.ss for d in descendants))
            checked += 1
            stack.append(entry.child)
    assert checked > 0, "tree never grew past a single leaf; raise n_samples"


def test_smaller_threshold_produces_more_leaf_entries():
    X, _ = generate("blobs", n_samples=180, random_seed=0)
    coarse = birch(X, threshold=1.2, branching_factor=8, record_trace=False)
    fine = birch(X, threshold=0.2, branching_factor=8, record_trace=False)
    assert fine.extras["n_leaf_entries"] > coarse.extras["n_leaf_entries"]


def test_trace_replay_reproduces_final_labels():
    X, _ = generate("blobs", n_samples=100, random_seed=0)
    result = birch(X, threshold=0.5, branching_factor=6, n_clusters=3, record_trace=True)
    replayed = [-1] * 100
    for step in result.trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
    assert replayed == result.labels


def test_trace_carries_tree_snapshots_and_paths():
    X, _ = generate("blobs", n_samples=60, random_seed=0)
    result = birch(X, threshold=0.4, branching_factor=3, n_clusters=3, record_trace=True)
    inserts = [s for s in result.trace["steps"] if s["kind"] in ("absorb", "new_entry")]
    assert inserts
    assert "tree" in inserts[0]["payload"]
    assert "path" in inserts[0]["payload"]
    assert result.extras["cf_tree"]["nodes"]


def test_splits_are_recorded_when_the_branching_factor_is_tight():
    X, _ = generate("blobs", n_samples=150, random_seed=0)
    result = birch(X, threshold=0.15, branching_factor=3, n_clusters=3, record_trace=True)
    assert any(s["kind"] == "split" for s in result.trace["steps"])


def test_single_point_and_duplicates():
    assert birch(np.array([[1.0, 2.0]]), threshold=0.5, record_trace=False).labels == [0]
    duplicates = birch(np.zeros((8, 2)), threshold=0.5, n_clusters=1, record_trace=False)
    assert set(duplicates.labels) == {0}


def test_n_clusters_above_leaf_count_is_clamped():
    X, _ = generate("blobs", n_samples=30, random_seed=0)
    result = birch(X, threshold=5.0, branching_factor=8, n_clusters=99, record_trace=False)
    assert len(set(result.labels)) <= 30


def test_invalid_parameters_are_rejected():
    X = np.zeros((5, 2))
    with pytest.raises(ValueError):
        birch(X, threshold=0.0)
    with pytest.raises(ValueError):
        birch(X, threshold=0.5, branching_factor=1)
    with pytest.raises(ValueError):
        birch(np.zeros((0, 2)), threshold=0.5)
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_birch.py -v`
Expected: FAIL — no module named `app.algorithms.birch`

- [ ] **Step 3: Implement `backend/app/algorithms/birch.py`**

```python
"""BIRCH — balanced iterative reducing and clustering using hierarchies.

Phase 1 compresses the data into a height-balanced CF-tree in a single pass.
Phase 2 runs agglomerative clustering over the leaf-entry centroids, weighted by
their counts, and every original point inherits its leaf entry's label.

A clustering feature is the triple (n, LS, SS): the member count, the vector sum
of the members, and the scalar sum of their squared magnitudes. Everything BIRCH
needs — centroid, radius, and the effect of a merge — follows from those three
numbers without revisiting the points, which is the whole trick.
"""

import itertools
from typing import Any

import numpy as np

from app.algorithms.trace import ClusterResult, TraceRecorder


class CFEntry:
    """One clustering feature, optionally pointing at a child node."""

    def __init__(self, n_features: int) -> None:
        self.n = 0
        self.ls = np.zeros(n_features, dtype=np.float64)
        self.ss = 0.0
        self.child: "CFNode | None" = None
        self.members: list[int] = []
        self._n_features = n_features

    @property
    def centroid(self) -> np.ndarray:
        """The mean of the absorbed points; the origin while the entry is empty."""
        if self.n == 0:
            return np.zeros(self._n_features, dtype=np.float64)
        return self.ls / self.n

    @property
    def radius(self) -> float:
        """Root-mean-square distance from the members to their centroid."""
        if self.n == 0:
            return 0.0
        centroid = self.centroid
        value = self.ss / self.n - float(centroid @ centroid)
        return float(np.sqrt(max(0.0, value)))

    def absorb(self, point: np.ndarray, index: int) -> None:
        """Add a single point to this entry."""
        self.n += 1
        self.ls += point
        self.ss += float(point @ point)
        self.members.append(index)

    def merge(self, other: "CFEntry") -> None:
        """Add another entry's statistics into this one. CFs are additive."""
        self.n += other.n
        self.ls += other.ls
        self.ss += other.ss
        self.members.extend(other.members)

    def radius_if_absorbed(self, point: np.ndarray) -> float:
        """What this entry's radius would become if it absorbed `point`."""
        n = self.n + 1
        ls = self.ls + point
        ss = self.ss + float(point @ point)
        centroid = ls / n
        return float(np.sqrt(max(0.0, ss / n - float(centroid @ centroid))))

    def copy_stats_from(self, others: list["CFEntry"]) -> None:
        """Recompute this entry's statistics as the sum of `others`."""
        self.n = sum(o.n for o in others)
        self.ls = np.sum([o.ls for o in others], axis=0) if others else np.zeros(self._n_features)
        self.ss = sum(o.ss for o in others)
        self.members = [m for o in others for m in o.members]


class CFNode:
    """A node in the CF-tree, holding at most `branching_factor` entries."""

    def __init__(self, is_leaf: bool, n_features: int, node_id: int) -> None:
        self.node_id = node_id
        self.is_leaf = is_leaf
        self.entries: list[CFEntry] = []
        self.parent: "CFNode | None" = None
        self._n_features = n_features


class CFTree:
    """The height-balanced tree built during BIRCH's first pass."""

    def __init__(self, threshold: float, branching_factor: int, n_features: int) -> None:
        if threshold <= 0:
            raise ValueError("threshold must be greater than 0")
        if branching_factor < 2:
            raise ValueError("branching_factor must be at least 2")
        self.threshold = threshold
        self.branching_factor = branching_factor
        self.n_features = n_features
        # Node ids are numbered per tree, never from a module-level counter.
        # The backend is a long-lived server: a process-global counter would hand
        # two identical requests different ids, so `extras["cf_tree"]` and every
        # trace `path`/`split_nodes` payload would differ between runs — breaking
        # the determinism the animation depends on.
        self._next_node_id = itertools.count()
        self.root = self._new_node(is_leaf=True)
        self.last_split: list[int] = []

    def _new_node(self, is_leaf: bool) -> CFNode:
        """Create a node carrying the next id unique to this tree."""
        return CFNode(is_leaf, self.n_features, next(self._next_node_id))

    def insert(self, point: np.ndarray, index: int) -> list[int]:
        """Insert one point, returning the node-id path from root to its leaf."""
        self.last_split = []
        path: list[int] = []
        node = self.root

        while True:
            path.append(node.node_id)
            if node.is_leaf:
                break
            entry = self._closest_entry(node, point)
            assert entry.child is not None
            node = entry.child

        self._insert_into_leaf(node, point, index)
        self._update_path_statistics(node)
        return path

    def _closest_entry(self, node: CFNode, point: np.ndarray) -> CFEntry:
        """The entry whose centroid is nearest `point`; ties break by position."""
        distances = [float(np.linalg.norm(entry.centroid - point)) for entry in node.entries]
        return node.entries[int(np.argmin(distances))]

    def _insert_into_leaf(self, leaf: CFNode, point: np.ndarray, index: int) -> None:
        if leaf.entries:
            entry = self._closest_entry(leaf, point)
            if entry.radius_if_absorbed(point) <= self.threshold:
                entry.absorb(point, index)
                return

        fresh = CFEntry(self.n_features)
        fresh.absorb(point, index)
        leaf.entries.append(fresh)

        if len(leaf.entries) > self.branching_factor:
            self._split(leaf)

    def _split(self, node: CFNode) -> None:
        """Split an overfull node on its two farthest entries and propagate up."""
        self.last_split.append(node.node_id)

        entries = node.entries
        centroids = np.array([e.centroid for e in entries])
        gaps = np.linalg.norm(centroids[:, None, :] - centroids[None, :, :], axis=-1)
        a, b = np.unravel_index(int(np.argmax(gaps)), gaps.shape)

        left_entries: list[CFEntry] = []
        right_entries: list[CFEntry] = []
        for i, entry in enumerate(entries):
            to_a = float(np.linalg.norm(entry.centroid - centroids[a]))
            to_b = float(np.linalg.norm(entry.centroid - centroids[b]))
            (left_entries if to_a <= to_b else right_entries).append(entry)

        # A degenerate split (everything on one side) would loop forever.
        if not left_entries or not right_entries:
            midpoint = len(entries) // 2
            left_entries, right_entries = entries[:midpoint], entries[midpoint:]

        left = self._new_node(node.is_leaf)
        right = self._new_node(node.is_leaf)
        left.entries, right.entries = left_entries, right_entries
        for child_node in (left, right):
            for entry in child_node.entries:
                if entry.child is not None:
                    entry.child.parent = child_node

        left_summary = CFEntry(self.n_features)
        left_summary.copy_stats_from(left.entries)
        left_summary.child = left
        right_summary = CFEntry(self.n_features)
        right_summary.copy_stats_from(right.entries)
        right_summary.child = right

        parent = node.parent
        if parent is None:
            new_root = self._new_node(is_leaf=False)
            new_root.entries = [left_summary, right_summary]
            left.parent = right.parent = new_root
            self.root = new_root
            return

        parent.entries = [e for e in parent.entries if e.child is not node]
        parent.entries.extend([left_summary, right_summary])
        left.parent = right.parent = parent

        if len(parent.entries) > self.branching_factor:
            self._split(parent)

    def _update_path_statistics(self, leaf: CFNode) -> None:
        """Refresh every ancestor summary entry after an insertion."""
        node = leaf
        while node.parent is not None:
            parent = node.parent
            for entry in parent.entries:
                if entry.child is node:
                    entry.copy_stats_from(node.entries)
                    break
            node = parent

    def leaf_entries(self) -> list[CFEntry]:
        """Every entry in every leaf, left to right."""
        found: list[CFEntry] = []
        stack = [self.root]
        while stack:
            node = stack.pop()
            if node.is_leaf:
                found.extend(node.entries)
            else:
                stack.extend(e.child for e in node.entries if e.child is not None)
        return found

    def serialize(self) -> dict[str, Any]:
        """A JSON-safe tree carrying only what the visualisation draws."""
        nodes: list[dict[str, Any]] = []
        stack = [(self.root, None)]
        while stack:
            node, parent_id = stack.pop()
            entries = []
            for entry in node.entries:
                entries.append({
                    "n": entry.n,
                    "centroid": entry.centroid.tolist(),
                    "radius": entry.radius,
                    "child": entry.child.node_id if entry.child is not None else None,
                })
                if entry.child is not None:
                    stack.append((entry.child, node.node_id))
            nodes.append({
                "id": node.node_id,
                "parent": parent_id,
                "is_leaf": node.is_leaf,
                "entries": entries,
            })
        return {"nodes": nodes, "root": self.root.node_id}


def _agglomerate(centroids: np.ndarray, weights: np.ndarray, n_clusters: int) -> list[int]:
    """Weighted agglomerative clustering by centroid distance.

    Returns a cluster id per input centroid. Used for BIRCH's second phase, where
    the inputs are leaf-entry centroids rather than raw points.
    """
    m = len(centroids)
    assignment = list(range(m))
    active = {i: [i] for i in range(m)}
    sums = {i: centroids[i] * weights[i] for i in range(m)}
    counts = {i: float(weights[i]) for i in range(m)}

    while len(active) > n_clusters:
        keys = sorted(active)
        best: tuple[float, int, int] | None = None
        for a_pos, a in enumerate(keys):
            for b in keys[a_pos + 1:]:
                gap = float(np.linalg.norm(sums[a] / counts[a] - sums[b] / counts[b]))
                if best is None or gap < best[0]:
                    best = (gap, a, b)
        if best is None:
            break
        _, a, b = best
        active[a].extend(active.pop(b))
        sums[a] = sums[a] + sums[b]
        counts[a] = counts[a] + counts[b]

    for new_id, members in enumerate(active[key] for key in sorted(active)):
        for member in members:
            assignment[member] = new_id
    return assignment


def birch(
    X: np.ndarray,
    threshold: float = 0.5,
    branching_factor: int = 50,
    n_clusters: int | None = None,
    record_trace: bool = True,
    max_steps: int = 5000,
) -> ClusterResult:
    """Cluster X by building a CF-tree, then clustering its leaf entries.

    Returns a ClusterResult whose extras carry `cf_tree` (the serialised final
    tree), `n_leaf_entries`, `entry_centroids`, `entry_radii`, and `entry_labels`.
    """
    X = np.asarray(X, dtype=np.float64)
    if X.ndim != 2 or X.shape[0] == 0:
        raise ValueError("X must be a non-empty 2-D array of shape (n, d)")
    if threshold <= 0:
        raise ValueError("threshold must be greater than 0")
    if branching_factor < 2:
        raise ValueError("branching_factor must be at least 2")

    n = X.shape[0]
    rec = TraceRecorder(n, enabled=record_trace, max_steps=max_steps)
    tree = CFTree(threshold, branching_factor, X.shape[1])

    for i, point in enumerate(X):
        before = len(tree.leaf_entries())
        path = tree.insert(point, i)
        after = len(tree.leaf_entries())
        created = after > before

        kind = "new_entry" if created else "absorb"
        narration = (
            f"Point {i} does not fit any leaf entry within T={threshold:g}, "
            f"so a new entry is created ({after} leaf entries now)."
            if created
            else f"Point {i} is absorbed into the closest leaf entry, whose radius "
            f"stays within T={threshold:g}."
        )
        rec.record(
            kind,
            narration,
            payload={
                "point": i,
                "path": path,
                "tree": tree.serialize() if record_trace else {},
                "n_leaf_entries": after,
            },
            significant=created,
        )

        if tree.last_split:
            rec.record(
                "split",
                f"A node overflowed past B={branching_factor} entries, so it split "
                f"on its two farthest entries and promoted them to the parent.",
                payload={
                    "split_nodes": list(tree.last_split),
                    "tree": tree.serialize() if record_trace else {},
                },
                significant=True,
            )

    entries = tree.leaf_entries()
    centroids = np.array([entry.centroid for entry in entries])
    weights = np.array([entry.n for entry in entries], dtype=np.float64)

    target = len(entries) if n_clusters is None else max(1, min(n_clusters, len(entries)))
    entry_labels = _agglomerate(centroids, weights, target)

    delta: dict[int, int] = {}
    for entry, label in zip(entries, entry_labels):
        for member in entry.members:
            delta[member] = label

    rec.record(
        "global_cluster",
        f"Phase 2: {len(entries)} leaf entries agglomerated into {target} cluster(s); "
        f"every point inherits its entry's label.",
        labels_delta=delta,
        payload={
            "n_leaf_entries": len(entries),
            "n_clusters": target,
            "entry_centroids": centroids.tolist(),
            "entry_radii": [entry.radius for entry in entries],
            "entry_labels": entry_labels,
        },
        significant=True,
    )
    rec.record(
        "done",
        f"Finished: {target} cluster(s) from {len(entries)} leaf entries.",
        payload={"n_clusters": target},
        significant=True,
    )

    return ClusterResult(
        labels=list(rec.labels),
        extras={
            "cf_tree": tree.serialize(),
            "n_leaf_entries": len(entries),
            "entry_centroids": centroids.tolist(),
            "entry_radii": [entry.radius for entry in entries],
            "entry_labels": entry_labels,
        },
        trace=rec.finish(),
    )
```

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_birch.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/algorithms/birch.py backend/tests/test_birch.py
git commit -m "feat: implement BIRCH with CF-tree and execution trace"
```

---

## Task 8: CURE

**Files:**
- Create: `backend/app/algorithms/cure.py`
- Test: `backend/tests/test_cure.py`

**Interfaces:**
- Consumes: `TraceRecorder`, `ClusterResult` from `app.algorithms.trace`.
- Produces: `cure(X, n_clusters=3, n_representatives=5, shrink_factor=0.2, sample_size=None, random_seed=42, record_trace=True, max_steps=5000) -> ClusterResult`.
  - `extras` holds `representatives: dict[str, list[list[float]]]` (cluster id to its shrunken representative coordinates), `sample_indices: list[int]`, and `n_sampled: int`.
  - Step kinds: `sample`, `init`, `merge`, `shrink`, `assign`, `done`.

**Design note:** representatives are chosen by farthest-first traversal starting from the member nearest the centroid, which is deterministic. Shrinking moves each representative toward the centroid by `shrink_factor`: `rep + alpha * (centroid - rep)`. With `alpha = 1` every representative collapses onto the centroid, degenerating to centroid-based merging — that equivalence is a test, because it is the clearest way to show what the shrink parameter buys you.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_cure.py`:

```python
import numpy as np
import pytest

from app.algorithms.cure import cure
from app.data.generators import generate


def agreement(a, b):
    a, b = np.asarray(a), np.asarray(b)
    n = len(a)
    same_a = a[:, None] == a[None, :]
    same_b = b[:, None] == b[None, :]
    return float((same_a == same_b).sum() - n) / (n * n - n)


def test_recovers_well_separated_blobs():
    X, truth = generate("blobs", n_samples=150, noise=0.02, random_seed=0)
    result = cure(X, n_clusters=3, n_representatives=5, shrink_factor=0.2, record_trace=False)
    assert agreement(result.labels, truth) > 0.95


def test_representatives_beat_a_single_centroid_on_non_convex_clusters():
    """CURE's central claim, on the data where it actually holds.

    With c=1 and alpha=1 every cluster collapses to its centroid. For two
    interleaving crescents those centroids sit almost on top of each other, so
    centroid-based merging cannot separate them. Ten representatives at low
    shrink stay out on the cluster boundary and follow the shape instead.

    Note this is deliberately NOT tested on `anisotropic`: those blobs are
    well-separated, so a single centroid already handles them and extra
    representatives only invite chaining. Multi-representative clustering is not
    universally better — it is better on shapes a centroid cannot describe.
    """
    X, truth = generate("moons", n_samples=90, noise=0.02, random_seed=0)
    centroid_like = cure(
        X, n_clusters=2, n_representatives=1, shrink_factor=1.0, record_trace=False
    )
    with_representatives = cure(
        X, n_clusters=2, n_representatives=10, shrink_factor=0.1, record_trace=False
    )
    assert agreement(centroid_like.labels, truth) < 0.8
    assert agreement(with_representatives.labels, truth) > 0.95


def test_higher_shrink_damps_chaining_on_elongated_clusters():
    """The trade-off the shrink factor exists to control.

    A low alpha leaves representatives out at the cluster edges, which is what
    lets CURE follow a shape — but on elongated, closely-spaced clusters it also
    invites the chaining that single-linkage suffers from, because two clusters'
    nearest boundary points can be far closer than the clusters themselves are.
    Raising alpha pulls the representatives inward and damps it.
    """
    X, truth = generate("anisotropic", n_samples=90, noise=0.02, random_seed=1)
    chained = cure(
        X, n_clusters=3, n_representatives=8, shrink_factor=0.2, record_trace=False
    )
    damped = cure(
        X, n_clusters=3, n_representatives=8, shrink_factor=0.5, record_trace=False
    )
    assert agreement(damped.labels, truth) > agreement(chained.labels, truth)


def test_produces_exactly_n_clusters():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    for k in (2, 3, 5):
        result = cure(X, n_clusters=k, record_trace=False)
        assert len(set(result.labels)) == k


def test_every_point_is_assigned():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    result = cure(X, n_clusters=3, record_trace=False)
    assert len(result.labels) == 120
    assert -1 not in result.labels


def test_representative_count_is_capped():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    result = cure(X, n_clusters=3, n_representatives=4, record_trace=False)
    for reps in result.extras["representatives"].values():
        assert 1 <= len(reps) <= 4


def test_alpha_one_puts_every_representative_at_the_centroid():
    X, _ = generate("blobs", n_samples=90, random_seed=0)
    result = cure(X, n_clusters=3, n_representatives=5, shrink_factor=1.0, record_trace=False)
    for cluster_id, reps in result.extras["representatives"].items():
        reps = np.array(reps)
        assert np.allclose(reps, reps[0])


def test_alpha_zero_leaves_representatives_on_real_points():
    X, _ = generate("blobs", n_samples=90, random_seed=0)
    result = cure(X, n_clusters=3, n_representatives=5, shrink_factor=0.0, record_trace=False)
    for reps in result.extras["representatives"].values():
        for rep in reps:
            distances = np.linalg.norm(X - np.array(rep), axis=1)
            assert distances.min() < 1e-9


def test_sampling_labels_every_original_point():
    X, _ = generate("blobs", n_samples=200, random_seed=0)
    result = cure(X, n_clusters=3, sample_size=60, random_seed=1, record_trace=False)
    assert result.extras["n_sampled"] == 60
    assert len(result.labels) == 200
    assert -1 not in result.labels


def test_is_deterministic_across_runs():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    a = cure(X, n_clusters=3, sample_size=50, random_seed=7, record_trace=False).labels
    b = cure(X, n_clusters=3, sample_size=50, random_seed=7, record_trace=False).labels
    assert a == b


def test_trace_replay_reproduces_final_labels():
    X, _ = generate("blobs", n_samples=80, random_seed=0)
    result = cure(X, n_clusters=3, record_trace=True)
    replayed = [-1] * 80
    for step in result.trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
    assert replayed == result.labels


def test_trace_carries_shrink_endpoints_for_tweening():
    X, _ = generate("blobs", n_samples=60, random_seed=0)
    result = cure(X, n_clusters=3, n_representatives=4, record_trace=True)
    shrinks = [s for s in result.trace["steps"] if s["kind"] == "shrink"]
    assert shrinks
    payload = shrinks[0]["payload"]
    assert len(payload["reps_before"]) == len(payload["reps_after"])
    assert "centroid" in payload and "alpha" in payload


def test_merge_steps_report_the_pair_and_remaining_count():
    X, _ = generate("blobs", n_samples=60, random_seed=0)
    result = cure(X, n_clusters=3, record_trace=True)
    merges = [s for s in result.trace["steps"] if s["kind"] == "merge"]
    assert merges
    assert len(merges[0]["payload"]["merged"]) == 2
    assert merges[0]["payload"]["clusters_remaining"] >= 3


def test_single_point_and_duplicates():
    assert cure(np.array([[1.0, 2.0]]), n_clusters=1, record_trace=False).labels == [0]
    duplicates = cure(np.zeros((8, 2)), n_clusters=1, record_trace=False)
    assert set(duplicates.labels) == {0}


def test_n_clusters_above_n_points_is_rejected():
    with pytest.raises(ValueError):
        cure(np.zeros((3, 2)), n_clusters=5)


def test_invalid_parameters_are_rejected():
    X = np.zeros((10, 2))
    with pytest.raises(ValueError):
        cure(X, n_clusters=2, shrink_factor=1.5)
    with pytest.raises(ValueError):
        cure(X, n_clusters=2, shrink_factor=-0.1)
    with pytest.raises(ValueError):
        cure(X, n_clusters=0)
    with pytest.raises(ValueError):
        cure(X, n_clusters=2, n_representatives=0)
    with pytest.raises(ValueError):
        cure(np.zeros((0, 2)), n_clusters=1)
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_cure.py -v`
Expected: FAIL — no module named `app.algorithms.cure`

- [ ] **Step 3: Implement `backend/app/algorithms/cure.py`**

```python
"""CURE — clustering using representatives.

Each cluster is summarised by several well-scattered points shrunk toward its
centroid, rather than by a single centroid. That is what lets CURE follow
elongated and non-spherical shapes while the shrink factor keeps outliers from
dragging a cluster outward.
"""

from typing import Any

import numpy as np

from app.algorithms.trace import ClusterResult, TraceRecorder


def _scattered_representatives(
    members: np.ndarray, centroid: np.ndarray, count: int
) -> np.ndarray:
    """Pick up to `count` well-spread members by farthest-first traversal.

    The traversal starts from the member closest to the centroid, so the choice
    is deterministic rather than dependent on a random seed.
    """
    if len(members) <= count:
        return members.copy()

    first = int(np.argmin(np.linalg.norm(members - centroid, axis=1)))
    chosen = [first]
    gaps = np.linalg.norm(members - members[first], axis=1)

    while len(chosen) < count:
        nxt = int(np.argmax(gaps))
        if nxt in chosen:
            break
        chosen.append(nxt)
        gaps = np.minimum(gaps, np.linalg.norm(members - members[nxt], axis=1))

    return members[chosen]


def _shrink(representatives: np.ndarray, centroid: np.ndarray, alpha: float) -> np.ndarray:
    """Move each representative a fraction `alpha` of the way to the centroid."""
    return representatives + alpha * (centroid - representatives)


def _closest_representative_distance(a: np.ndarray, b: np.ndarray) -> float:
    """The smallest distance between any representative of a and any of b."""
    return float(np.min(np.linalg.norm(a[:, None, :] - b[None, :, :], axis=-1)))


def cure(
    X: np.ndarray,
    n_clusters: int = 3,
    n_representatives: int = 5,
    shrink_factor: float = 0.2,
    sample_size: int | None = None,
    random_seed: int = 42,
    record_trace: bool = True,
    max_steps: int = 5000,
) -> ClusterResult:
    """Cluster X by hierarchically merging clusters of representative points.

    Returns a ClusterResult whose extras carry `representatives` (cluster id to
    its shrunken representative coordinates), `sample_indices`, and `n_sampled`.
    """
    X = np.asarray(X, dtype=np.float64)
    if X.ndim != 2 or X.shape[0] == 0:
        raise ValueError("X must be a non-empty 2-D array of shape (n, d)")
    if n_clusters < 1:
        raise ValueError("n_clusters must be at least 1")
    if n_clusters > X.shape[0]:
        raise ValueError("n_clusters cannot exceed the number of points")
    if n_representatives < 1:
        raise ValueError("n_representatives must be at least 1")
    if not 0.0 <= shrink_factor <= 1.0:
        raise ValueError("shrink_factor must lie between 0 and 1")

    n = X.shape[0]
    rec = TraceRecorder(n, enabled=record_trace, max_steps=max_steps)

    if sample_size is not None and sample_size < n:
        size = max(n_clusters, int(sample_size))
        rng = np.random.default_rng(random_seed)
        sample_indices = np.sort(rng.choice(n, size=size, replace=False))
        rec.record(
            "sample",
            f"Sampled {size} of {n} points (seed {random_seed}); the rest are "
            f"labelled at the end by their nearest representative.",
            payload={"sample_indices": sample_indices.tolist(), "n_sampled": size},
            significant=True,
        )
    else:
        sample_indices = np.arange(n)

    sample = X[sample_indices]

    # Each surviving cluster: member indices (into `sample`) and its representatives.
    members: dict[int, list[int]] = {i: [i] for i in range(len(sample))}
    reps: dict[int, np.ndarray] = {i: sample[i : i + 1].copy() for i in range(len(sample))}

    rec.record(
        "init",
        f"Starting with {len(sample)} singleton cluster(s); each point is its own "
        f"cluster and its own representative.",
        payload={"clusters_remaining": len(sample)},
        significant=True,
    )

    next_id = len(sample)

    while len(members) > n_clusters:
        keys = sorted(members)
        best: tuple[float, int, int] | None = None
        for a_pos, a in enumerate(keys):
            for b in keys[a_pos + 1:]:
                gap = _closest_representative_distance(reps[a], reps[b])
                if best is None or gap < best[0]:
                    best = (gap, a, b)

        assert best is not None
        gap, a, b = best

        merged_members = members.pop(a) + members.pop(b)
        merged_id = next_id
        next_id += 1
        members[merged_id] = merged_members

        member_points = sample[merged_members]
        centroid = member_points.mean(axis=0)
        chosen = _scattered_representatives(member_points, centroid, n_representatives)
        shrunk = _shrink(chosen, centroid, shrink_factor)
        reps.pop(a, None)
        reps.pop(b, None)
        reps[merged_id] = shrunk

        rec.record(
            "merge",
            f"Merging clusters {a} and {b} — their closest representatives are "
            f"{gap:.3f} apart, the smallest gap remaining.",
            payload={
                "merged": [a, b],
                "new_cluster_id": merged_id,
                "distance": gap,
                "clusters_remaining": len(members),
            },
            significant=True,
        )
        rec.record(
            "shrink",
            f"Picked {len(chosen)} scattered representative(s) for cluster "
            f"{merged_id} and shrank them {shrink_factor:.0%} toward the centroid.",
            payload={
                "cluster_id": merged_id,
                "reps_before": chosen.tolist(),
                "reps_after": shrunk.tolist(),
                "centroid": centroid.tolist(),
                "alpha": shrink_factor,
                "clusters_remaining": len(members),
            },
        )

    # Renumber the surviving clusters to 0..k-1 and label the sampled points.
    final_ids = sorted(members)
    label_of: dict[int, int] = {}
    delta: dict[int, int] = {}
    for label, cluster_id in enumerate(final_ids):
        label_of[cluster_id] = label
        for member in members[cluster_id]:
            delta[int(sample_indices[member])] = label

    rec.record(
        "assign",
        f"Merging complete at {len(final_ids)} cluster(s); sampled points take "
        f"their cluster's label.",
        labels_delta=delta,
        payload={"clusters_remaining": len(final_ids)},
        significant=True,
    )

    representatives: dict[str, list[list[float]]] = {
        str(label_of[cluster_id]): reps[cluster_id].tolist() for cluster_id in final_ids
    }

    if len(sample_indices) < n:
        rep_points = np.vstack([reps[cluster_id] for cluster_id in final_ids])
        rep_labels = np.concatenate([
            np.full(len(reps[cluster_id]), label_of[cluster_id]) for cluster_id in final_ids
        ])
        outside = np.setdiff1d(np.arange(n), sample_indices)
        gaps = np.linalg.norm(X[outside][:, None, :] - rep_points[None, :, :], axis=-1)
        nearest = rep_labels[np.argmin(gaps, axis=1)]

        rec.record(
            "assign",
            f"Labelled the {len(outside)} unsampled point(s) by nearest shrunken "
            f"representative.",
            labels_delta={int(idx): int(label) for idx, label in zip(outside, nearest)},
            payload={"n_assigned": int(len(outside))},
            significant=True,
        )

    rec.record(
        "done",
        f"Finished: {len(final_ids)} cluster(s), each summarised by up to "
        f"{n_representatives} representative(s).",
        payload={"n_clusters": len(final_ids), "representatives": representatives},
        significant=True,
    )

    extras: dict[str, Any] = {
        "representatives": representatives,
        "sample_indices": sample_indices.tolist(),
        "n_sampled": int(len(sample_indices)),
    }
    return ClusterResult(labels=list(rec.labels), extras=extras, trace=rec.finish())
```

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_cure.py -v`
Expected: all passed

- [ ] **Step 5: Run the whole backend suite**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: all passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/algorithms/cure.py backend/tests/test_cure.py
git commit -m "feat: implement CURE with representative shrinking and trace"
```

---

## Task 9: File ingestion

**Files:**
- Create: `backend/app/data/ingest.py`
- Test: `backend/tests/test_ingest.py`

**Interfaces:**
- Consumes: `ApiError` from `app.errors`.
- Produces: `parse_table(filename: str, content: bytes) -> dict` returning `{"columns": list[str], "dtypes": list[str], "rows": list[list], "n_rows": int, "suggested_features": list[str]}`.
  - `dtypes` entries are `"numeric"` or `"text"`.
  - `suggested_features` lists the first two numeric columns, so the UI can pre-select something sensible.
  - Raises `ApiError` with codes `empty_file`, `unsupported_format`, `unparseable`, or `no_columns`.

**Design note:** the CSV delimiter is sniffed by counting candidate separators on the first non-empty line and taking the most frequent. Header detection asks whether the first row is entirely non-numeric while at least one later row has a numeric cell — if so it is a header, otherwise columns are named `col_1`, `col_2`, and so on. Numeric cells parse as float; a column is `numeric` only if every non-empty cell in it parses.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_ingest.py`:

```python
import json

import pytest

from app.data.ingest import parse_table
from app.errors import ApiError


def test_parses_csv_with_header():
    content = b"x,y,label\n1.0,2.0,a\n3.0,4.0,b\n"
    table = parse_table("data.csv", content)
    assert table["columns"] == ["x", "y", "label"]
    assert table["dtypes"] == ["numeric", "numeric", "text"]
    assert table["rows"] == [[1.0, 2.0, "a"], [3.0, 4.0, "b"]]
    assert table["n_rows"] == 2
    assert table["suggested_features"] == ["x", "y"]


def test_parses_csv_without_header():
    content = b"1.0,2.0\n3.0,4.0\n"
    table = parse_table("data.csv", content)
    assert table["columns"] == ["col_1", "col_2"]
    assert table["n_rows"] == 2


def test_sniffs_semicolon_and_tab_delimiters():
    semi = parse_table("d.csv", b"x;y\n1;2\n3;4\n")
    assert semi["columns"] == ["x", "y"]
    tab = parse_table("d.csv", b"x\ty\n1\t2\n3\t4\n")
    assert tab["columns"] == ["x", "y"]


def test_handles_crlf_line_endings_and_blank_lines():
    table = parse_table("d.csv", b"x,y\r\n1,2\r\n\r\n3,4\r\n")
    assert table["n_rows"] == 2


def test_ragged_rows_are_padded_not_rejected():
    table = parse_table("d.csv", b"x,y,z\n1,2\n3,4,5\n")
    assert all(len(row) == 3 for row in table["rows"])


def test_missing_values_become_none():
    table = parse_table("d.csv", b"x,y\n1,\n3,4\n")
    assert table["rows"][0][1] is None
    assert table["dtypes"][1] == "numeric"


def test_parses_json_array_of_objects():
    content = json.dumps([{"x": 1, "y": 2}, {"x": 3, "y": 4}]).encode()
    table = parse_table("data.json", content)
    assert table["columns"] == ["x", "y"]
    assert table["rows"] == [[1.0, 2.0], [3.0, 4.0]]


def test_parses_json_array_of_arrays():
    content = json.dumps([[1, 2], [3, 4]]).encode()
    table = parse_table("data.json", content)
    assert table["columns"] == ["col_1", "col_2"]
    assert table["n_rows"] == 2


def test_json_objects_with_differing_keys_union_the_columns():
    content = json.dumps([{"x": 1}, {"y": 2}]).encode()
    table = parse_table("data.json", content)
    assert set(table["columns"]) == {"x", "y"}
    assert table["n_rows"] == 2


def test_suggested_features_skips_text_columns():
    table = parse_table("d.csv", b"name,x,y\na,1,2\nb,3,4\n")
    assert table["suggested_features"] == ["x", "y"]


def test_suggested_features_is_empty_when_nothing_is_numeric():
    table = parse_table("d.csv", b"a,b\nfoo,bar\nbaz,qux\n")
    assert table["suggested_features"] == []


def test_empty_file_is_rejected():
    with pytest.raises(ApiError) as excinfo:
        parse_table("d.csv", b"")
    assert excinfo.value.code == "empty_file"


def test_unsupported_extension_is_rejected():
    with pytest.raises(ApiError) as excinfo:
        parse_table("data.xlsx", b"anything")
    assert excinfo.value.code == "unsupported_format"


def test_malformed_json_is_rejected():
    with pytest.raises(ApiError) as excinfo:
        parse_table("data.json", b"{not json")
    assert excinfo.value.code == "unparseable"


def test_json_scalar_is_rejected():
    with pytest.raises(ApiError) as excinfo:
        parse_table("data.json", b"42")
    assert excinfo.value.code == "unparseable"
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_ingest.py -v`
Expected: FAIL — no module named `app.data.ingest`

- [ ] **Step 3: Implement `backend/app/data/ingest.py`**

```python
"""Parsing of uploaded CSV and JSON files into a plain table.

The backend keeps no state between requests, so this returns the whole parsed
table in one response and the frontend owns column selection from there.
"""

import csv
import io
import json
from typing import Any

from app.errors import ApiError

_DELIMITERS = [",", ";", "\t", "|"]


def _as_number(value: Any) -> float | None:
    """Parse a cell as a float, or return None if it is blank or non-numeric."""
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _sniff_delimiter(sample: str) -> str:
    """Pick the delimiter appearing most often on the first non-empty line."""
    for line in sample.splitlines():
        if line.strip():
            counts = {d: line.count(d) for d in _DELIMITERS}
            best = max(counts, key=lambda d: counts[d])
            return best if counts[best] > 0 else ","
    return ","


def _looks_like_header(first: list[str], rest: list[list[str]]) -> bool:
    """True when the first row is all text but a later row has numbers."""
    if not rest:
        return False
    first_is_text = all(_as_number(cell) is None for cell in first if str(cell).strip())
    later_has_numbers = any(
        _as_number(cell) is not None for row in rest for cell in row
    )
    return first_is_text and later_has_numbers


def _finalise(columns: list[str], rows: list[list[Any]]) -> dict[str, Any]:
    """Normalise row widths, infer column types, and suggest features."""
    if not columns:
        raise ApiError("no_columns", "The file has no columns to read.", status=422)

    width = len(columns)
    padded: list[list[Any]] = []
    for row in rows:
        trimmed = list(row[:width])
        trimmed.extend([None] * (width - len(trimmed)))
        padded.append(trimmed)

    dtypes: list[str] = []
    typed: list[list[Any]] = [list(row) for row in padded]
    for col in range(width):
        values = [row[col] for row in padded]
        present = [v for v in values if v is not None and str(v).strip() != ""]
        numeric = bool(present) and all(_as_number(v) is not None for v in present)
        dtypes.append("numeric" if numeric else "text")
        for r, value in enumerate(values):
            if numeric:
                typed[r][col] = _as_number(value)
            elif value is None or str(value).strip() == "":
                typed[r][col] = None
            else:
                typed[r][col] = str(value)

    suggested = [name for name, dt in zip(columns, dtypes) if dt == "numeric"][:2]

    return {
        "columns": columns,
        "dtypes": dtypes,
        "rows": typed,
        "n_rows": len(typed),
        "suggested_features": suggested,
    }


def _parse_csv(text: str) -> dict[str, Any]:
    delimiter = _sniff_delimiter(text)
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    raw = [row for row in reader if any(str(cell).strip() for cell in row)]
    if not raw:
        raise ApiError("empty_file", "The file contains no rows.", status=422)

    if _looks_like_header(raw[0], raw[1:]):
        columns = [cell.strip() or f"col_{i + 1}" for i, cell in enumerate(raw[0])]
        rows: list[list[Any]] = [list(row) for row in raw[1:]]
    else:
        columns = [f"col_{i + 1}" for i in range(len(raw[0]))]
        rows = [list(row) for row in raw]

    if not rows:
        raise ApiError("empty_file", "The file has a header but no data rows.", status=422)
    return _finalise(columns, rows)


def _parse_json(text: str) -> dict[str, Any]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ApiError("unparseable", f"Could not parse JSON: {exc.msg}", status=422) from exc

    if not isinstance(payload, list) or not payload:
        raise ApiError(
            "unparseable",
            "Expected a non-empty JSON array of objects or arrays.",
            status=422,
        )

    if isinstance(payload[0], dict):
        columns: list[str] = []
        for record in payload:
            if not isinstance(record, dict):
                raise ApiError("unparseable", "Mixed JSON record shapes.", status=422)
            for key in record:
                if key not in columns:
                    columns.append(str(key))
        rows = [[record.get(name) for name in columns] for record in payload]
        return _finalise(columns, rows)

    if isinstance(payload[0], list):
        width = max(len(row) for row in payload if isinstance(row, list))
        columns = [f"col_{i + 1}" for i in range(width)]
        rows = [list(row) for row in payload if isinstance(row, list)]
        return _finalise(columns, rows)

    raise ApiError(
        "unparseable",
        "Expected a JSON array of objects or arrays, not scalars.",
        status=422,
    )


def parse_table(filename: str, content: bytes) -> dict[str, Any]:
    """Parse an uploaded CSV or JSON file into columns, dtypes, and rows."""
    if not content or not content.strip():
        raise ApiError("empty_file", "The uploaded file is empty.", status=422)

    text = content.decode("utf-8-sig", errors="replace")
    lowered = filename.lower()

    if lowered.endswith(".json"):
        return _parse_json(text)
    if lowered.endswith((".csv", ".tsv", ".txt")):
        return _parse_csv(text)

    raise ApiError(
        "unsupported_format",
        f"Cannot read {filename!r}. Upload a .csv, .tsv, .txt, or .json file.",
        status=415,
    )
```

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_ingest.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/data/ingest.py backend/tests/test_ingest.py
git commit -m "feat: add CSV and JSON ingestion"
```

---

## Task 10: Algorithm registry — parameter schemas and theory

**Files:**
- Create: `backend/app/registry.py`
- Test: `backend/tests/test_registry.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `ALGORITHMS: dict[str, dict]`. Each entry has:
  - `key`, `label`, `tagline`
  - `params: list[dict]` — each with `name`, `label`, `type` (`"float"` | `"int"` | `"choice"` | `"bool"`), `default`, and for numbers `min`, `max`, `step`; for choices `options`; plus `help` text.
  - `theory: dict` with `summary`, `how_it_works` (list of strings), `parameters` (dict of param name to explanation), `complexity`, `strengths` (list), `weaknesses` (list).

This single structure drives the frontend's parameter panels *and* its theory panels, so the UI can never describe a parameter the backend does not accept.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_registry.py`:

```python
import inspect

import pytest

from app.algorithms.birch import birch
from app.algorithms.cure import cure
from app.algorithms.dbscan import dbscan
from app.registry import ALGORITHMS

IMPLEMENTATIONS = {"dbscan": dbscan, "birch": birch, "cure": cure}


def test_all_three_algorithms_are_registered():
    assert set(ALGORITHMS) == {"dbscan", "birch", "cure"}


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_registry_entries_are_complete(key):
    entry = ALGORITHMS[key]
    assert entry["key"] == key
    assert entry["label"] and entry["tagline"]
    assert entry["params"]
    theory = entry["theory"]
    assert theory["summary"]
    assert theory["how_it_works"]
    assert theory["complexity"]
    assert theory["strengths"] and theory["weaknesses"]


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_every_declared_param_exists_on_the_implementation(key):
    signature = inspect.signature(IMPLEMENTATIONS[key])
    for param in ALGORITHMS[key]["params"]:
        assert param["name"] in signature.parameters, param["name"]


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_declared_defaults_match_the_implementation(key):
    signature = inspect.signature(IMPLEMENTATIONS[key])
    for param in ALGORITHMS[key]["params"]:
        actual = signature.parameters[param["name"]].default
        if actual is not inspect.Parameter.empty and param["default"] is not None:
            assert actual == param["default"], param["name"]


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_numeric_params_declare_a_usable_range(key):
    for param in ALGORITHMS[key]["params"]:
        if param["type"] in ("float", "int"):
            assert param["min"] < param["max"]
            assert param["step"] > 0
        if param["type"] == "choice":
            assert param["options"]
            assert param["default"] in param["options"]


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_every_param_has_help_and_a_theory_entry(key):
    entry = ALGORITHMS[key]
    for param in entry["params"]:
        assert param["help"]
        assert param["name"] in entry["theory"]["parameters"]


def test_registry_is_json_serialisable():
    import json

    json.dumps(ALGORITHMS)
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_registry.py -v`
Expected: FAIL — no module named `app.registry`

- [ ] **Step 3: Implement `backend/app/registry.py`**

```python
"""One description of each algorithm, driving both the controls and the prose.

The frontend builds its parameter panels from `params` and its explainers from
`theory`, so the UI cannot offer a knob the backend will not accept, and the
help text beside a slider always matches the theory page.
"""

from typing import Any

ALGORITHMS: dict[str, dict[str, Any]] = {
    "dbscan": {
        "key": "dbscan",
        "label": "DBSCAN",
        "tagline": "Density-based clustering that finds arbitrary shapes and calls out noise.",
        "params": [
            {
                "name": "eps",
                "label": "eps (neighbourhood radius)",
                "type": "float",
                "default": 0.5,
                "min": 0.01,
                "max": 5.0,
                "step": 0.01,
                "help": "How far apart two points can be and still count as neighbours.",
            },
            {
                "name": "min_pts",
                "label": "minPts",
                "type": "int",
                "default": 5,
                "min": 1,
                "max": 50,
                "step": 1,
                "help": "How many neighbours (including itself) a point needs to be a core point.",
            },
            {
                "name": "metric",
                "label": "Distance metric",
                "type": "choice",
                "default": "euclidean",
                "options": ["euclidean", "manhattan"],
                "help": "How distance between two points is measured.",
            },
        ],
        "theory": {
            "summary": (
                "DBSCAN grows clusters outward from dense regions. It needs no cluster "
                "count, finds clusters of any shape, and is the only one of the three "
                "that can refuse to classify a point at all."
            ),
            "how_it_works": [
                "For each point, count how many points lie within eps of it (itself included).",
                "A point with at least minPts neighbours is a core point.",
                "Each unvisited core point starts a new cluster and seeds a frontier queue.",
                "The frontier absorbs neighbours; every core point it reaches extends it further.",
                "Non-core points reached by the frontier become border points and join that cluster.",
                "Points no frontier ever reaches stay labelled noise.",
            ],
            "parameters": {
                "eps": (
                    "The single most sensitive knob. Too small and everything is noise; "
                    "too large and separate clusters fuse into one. Because it is a "
                    "distance, it depends on your feature scaling."
                ),
                "min_pts": (
                    "Controls how dense a region must be to seed a cluster. A common "
                    "rule of thumb is at least the number of dimensions plus one; "
                    "raising it makes the algorithm more willing to call points noise."
                ),
                "metric": (
                    "Euclidean measures straight-line distance; Manhattan sums the "
                    "per-axis differences and tends to favour axis-aligned structure."
                ),
            },
            "complexity": (
                "O(n^2) time in this implementation, because every neighbourhood query "
                "scans all points. A spatial index such as an R-tree or k-d tree brings "
                "the average case to O(n log n)."
            ),
            "strengths": [
                "Finds arbitrarily shaped clusters, including the two-moons case.",
                "Needs no cluster count in advance.",
                "Identifies outliers explicitly instead of forcing them into a cluster.",
            ],
            "weaknesses": [
                "One global eps cannot handle clusters of very different densities.",
                "Highly sensitive to eps and to feature scaling.",
                "Struggles in high dimensions, where distances concentrate.",
                "Border points can belong to whichever cluster reaches them first.",
            ],
        },
    },
    "birch": {
        "key": "birch",
        "label": "BIRCH",
        "tagline": "Streams the data once into a compact CF-tree, then clusters the summary.",
        "params": [
            {
                "name": "threshold",
                "label": "threshold (T)",
                "type": "float",
                "default": 0.5,
                "min": 0.01,
                "max": 5.0,
                "step": 0.01,
                "help": "The largest radius a leaf entry is allowed to reach.",
            },
            {
                "name": "branching_factor",
                "label": "branching factor (B)",
                "type": "int",
                "default": 50,
                "min": 2,
                "max": 100,
                "step": 1,
                "help": "How many entries a node holds before it splits.",
            },
            {
                "name": "n_clusters",
                "label": "clusters (optional)",
                "type": "int",
                "default": None,
                "min": 1,
                "max": 20,
                "step": 1,
                "help": "Leave empty to use the leaf entries themselves as clusters.",
            },
        ],
        "theory": {
            "summary": (
                "BIRCH compresses the dataset into a height-balanced tree of clustering "
                "features in a single pass, then clusters that much smaller summary. It "
                "was designed for data too large to hold in memory."
            ),
            "how_it_works": [
                "A clustering feature stores three numbers: the count n, the vector sum LS, and the sum of squared magnitudes SS.",
                "Centroid and radius follow from those three numbers alone, so the points never need revisiting.",
                "Each incoming point descends the tree toward the closest centroid at every level.",
                "At the leaf it joins the closest entry if the entry's radius stays within T; otherwise it becomes a new entry.",
                "A node holding more than B entries splits on its two farthest entries, promoting both to the parent, which may split in turn.",
                "Phase 2 runs agglomerative clustering over the leaf-entry centroids, weighted by their counts, and every point inherits its entry's label.",
            ],
            "parameters": {
                "threshold": (
                    "Sets how much detail survives compression. A small T keeps many "
                    "small entries and preserves fine structure at the cost of memory; "
                    "a large T summarises aggressively and can merge distinct groups."
                ),
                "branching_factor": (
                    "Caps how many entries a node holds, controlling the tree's width "
                    "and height. It affects insertion cost and tree shape far more than "
                    "it affects the final clustering."
                ),
                "n_clusters": (
                    "The target for phase 2. Left empty, each leaf entry becomes its own "
                    "cluster, which shows the raw output of the compression step."
                ),
            },
            "complexity": (
                "O(n) time for the single-pass tree build, plus the cost of clustering "
                "the leaf entries. Memory is bounded by the tree, not by n, which is "
                "what makes it suitable for streaming data."
            ),
            "strengths": [
                "One pass over the data, so it scales to datasets that do not fit in memory.",
                "Naturally incremental: new points can be inserted at any time.",
                "The CF-tree is a reusable summary, not just a labelling.",
            ],
            "weaknesses": [
                "Assumes roughly spherical clusters, so it fails on moons and rings.",
                "The result depends on the order the points arrive in.",
                "T is scale-sensitive and hard to choose without inspecting the data.",
                "Handles only numeric features, since a CF is a sum.",
            ],
        },
    },
    "cure": {
        "key": "cure",
        "label": "CURE",
        "tagline": "Represents each cluster by several scattered points shrunk toward its centre.",
        "params": [
            {
                "name": "n_clusters",
                "label": "clusters (k)",
                "type": "int",
                "default": 3,
                "min": 1,
                "max": 20,
                "step": 1,
                "help": "How many clusters to stop merging at.",
            },
            {
                "name": "n_representatives",
                "label": "representatives (c)",
                "type": "int",
                "default": 5,
                "min": 1,
                "max": 20,
                "step": 1,
                "help": "How many scattered points summarise each cluster.",
            },
            {
                "name": "shrink_factor",
                "label": "shrink factor (alpha)",
                "type": "float",
                "default": 0.2,
                "min": 0.0,
                "max": 1.0,
                "step": 0.01,
                "help": "How far representatives move toward the centroid. 1 collapses them onto it.",
            },
            {
                "name": "sample_size",
                "label": "sample size (optional)",
                "type": "int",
                "default": None,
                "min": 10,
                "max": 2000,
                "step": 10,
                "help": "Cluster a random sample, then label the rest by nearest representative.",
            },
        ],
        "theory": {
            "summary": (
                "CURE sits between single-link and centroid-based clustering. Using "
                "several representatives per cluster lets it follow elongated shapes, "
                "while shrinking them toward the centroid blunts the chaining effect "
                "that outliers cause."
            ),
            "how_it_works": [
                "Optionally draw a random sample, so the expensive merging runs on fewer points.",
                "Start with every sampled point as its own cluster, each its own representative.",
                "Repeatedly merge the pair of clusters whose closest representatives are nearest.",
                "After a merge, pick up to c well-scattered members by farthest-first traversal.",
                "Shrink each representative toward the merged cluster's centroid by alpha.",
                "Stop at k clusters, then label any unsampled points by their nearest shrunken representative.",
            ],
            "parameters": {
                "n_clusters": (
                    "CURE is hierarchical, so this is simply where you cut the merge "
                    "sequence. It must be known in advance."
                ),
                "n_representatives": (
                    "With c=1 CURE degenerates toward centroid-based clustering. Raising "
                    "c lets a cluster describe a longer, more irregular shape."
                ),
                "shrink_factor": (
                    "At alpha=0 representatives sit on real boundary points, which is "
                    "expressive but outlier-prone. At alpha=1 they all collapse onto the "
                    "centroid. Values around 0.2 to 0.3 keep the shape while damping outliers."
                ),
                "sample_size": (
                    "Merging is the expensive part, so sampling is how CURE scales. The "
                    "sample must still be large enough to represent every real cluster."
                ),
            },
            "complexity": (
                "Roughly O(n^2 log n) for the merging phase on n sampled points, which is "
                "why sampling exists. Labelling the remaining points is O(n * total representatives)."
            ),
            "strengths": [
                "Handles elongated and non-spherical clusters far better than centroid methods.",
                "Shrinking gives real robustness to outliers.",
                "Sampling makes the hierarchical approach tractable on large data.",
            ],
            "weaknesses": [
                "Needs the cluster count in advance.",
                "Merging is expensive without sampling.",
                "Three interacting parameters (k, c, alpha) make tuning fiddly.",
                "A sample that misses a small cluster loses it entirely.",
            ],
        },
    },
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_registry.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/registry.py backend/tests/test_registry.py
git commit -m "feat: add algorithm registry with parameter schemas and theory"
```

---

## Task 11: API schemas and routes

**Files:**
- Create: `backend/app/schemas.py`, `backend/app/api/__init__.py`, `backend/app/api/routes.py`
- Modify: `backend/app/main.py` (mount the router)
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: everything built so far.
- Produces: the router mounted at `/api`, and `run_algorithm(name: str, X: np.ndarray, params: dict, record_trace: bool, max_steps: int) -> ClusterResult` as the single dispatch point.

**Endpoints** (exactly as specified in the design doc §8):

| Method | Path |
|---|---|
| GET | `/api/health` (already exists) |
| GET | `/api/algorithms` |
| GET | `/api/datasets/generators` |
| POST | `/api/datasets/generate` |
| POST | `/api/datasets/upload` |
| POST | `/api/cluster/{algorithm}` |
| POST | `/api/cluster/compare` |
| POST | `/api/analysis/project` |

- [ ] **Step 1: Write the failing test**

`backend/tests/test_api.py`:

```python
import io

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    return TestClient(create_app())


def blobs(client, n=80):
    response = client.post(
        "/api/datasets/generate",
        json={"kind": "blobs", "n_samples": n, "noise": 0.02, "random_seed": 0},
    )
    return response.json()["points"]


def test_algorithms_endpoint_lists_all_three(client):
    body = client.get("/api/algorithms").json()
    assert set(body["algorithms"]) == {"dbscan", "birch", "cure"}
    assert body["algorithms"]["dbscan"]["params"]


def test_generators_endpoint_lists_metadata(client):
    body = client.get("/api/datasets/generators").json()
    assert "blobs" in body["generators"]
    assert body["generators"]["blobs"]["hint"]


def test_generate_returns_points_and_ground_truth(client):
    response = client.post(
        "/api/datasets/generate",
        json={"kind": "moons", "n_samples": 50, "noise": 0.05, "random_seed": 1},
    )
    body = response.json()
    assert response.status_code == 200
    assert len(body["points"]) == 50
    assert len(body["points"][0]) == 2
    assert body["feature_names"] == ["x", "y"]
    assert len(body["source_labels"]) == 50


def test_generate_rejects_unknown_kind(client):
    response = client.post(
        "/api/datasets/generate", json={"kind": "spirals", "n_samples": 10}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"]


def test_upload_parses_csv(client):
    file = io.BytesIO(b"x,y\n1,2\n3,4\n")
    response = client.post(
        "/api/datasets/upload", files={"file": ("data.csv", file, "text/csv")}
    )
    body = response.json()
    assert response.status_code == 200
    assert body["columns"] == ["x", "y"]
    assert body["n_rows"] == 2
    assert body["rows"] == [[1.0, 2.0], [3.0, 4.0]]


def test_upload_rejects_unsupported_format(client):
    file = io.BytesIO(b"junk")
    response = client.post(
        "/api/datasets/upload", files={"file": ("data.xlsx", file, "application/octet-stream")}
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_format"


@pytest.mark.parametrize(
    "algorithm,params",
    [
        ("dbscan", {"eps": 0.9, "min_pts": 5}),
        ("birch", {"threshold": 0.5, "branching_factor": 8, "n_clusters": 3}),
        ("cure", {"n_clusters": 3, "n_representatives": 4, "shrink_factor": 0.2}),
    ],
)
def test_cluster_endpoint_returns_the_full_envelope(client, algorithm, params):
    points = blobs(client)
    response = client.post(
        f"/api/cluster/{algorithm}",
        json={"points": points, "params": params, "record_trace": True},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["algorithm"] == algorithm
    assert len(body["labels"]) == len(points)
    assert body["n_clusters"] >= 1
    assert body["runtime_ms"] >= 0
    assert "silhouette" in body["metrics"]
    assert body["projection"]["points_2d"]
    assert body["trace"]["steps"]
    assert body["params_used"]


def test_cluster_trace_can_be_disabled(client):
    points = blobs(client)
    response = client.post(
        "/api/cluster/dbscan",
        json={"points": points, "params": {"eps": 0.9, "min_pts": 5}, "record_trace": False},
    )
    assert response.json()["trace"]["steps"] == []


def test_cluster_rejects_unknown_algorithm(client):
    response = client.post(
        "/api/cluster/kmeans", json={"points": [[0.0, 0.0]], "params": {}}
    )
    assert response.status_code == 404


def test_cluster_rejects_empty_points(client):
    response = client.post(
        "/api/cluster/dbscan", json={"points": [], "params": {"eps": 0.5, "min_pts": 3}}
    )
    assert response.status_code == 422


def test_cluster_rejects_ragged_points(client):
    response = client.post(
        "/api/cluster/dbscan",
        json={"points": [[0.0, 0.0], [1.0]], "params": {"eps": 0.5, "min_pts": 3}},
    )
    assert response.status_code == 422


def test_cluster_rejects_non_finite_values(client):
    response = client.post(
        "/api/cluster/dbscan",
        json={"points": [[0.0, 0.0], [1.0, None]], "params": {"eps": 0.5, "min_pts": 3}},
    )
    assert response.status_code == 422


def test_cluster_rejects_bad_parameter_values(client):
    points = blobs(client, n=20)
    response = client.post(
        "/api/cluster/dbscan", json={"points": points, "params": {"eps": 0, "min_pts": 3}}
    )
    assert response.status_code == 422
    assert response.json()["error"]["message"]


def test_cluster_ignores_unknown_parameter_names(client):
    points = blobs(client, n=20)
    response = client.post(
        "/api/cluster/dbscan",
        json={"points": points, "params": {"eps": 0.9, "min_pts": 5, "bogus": 1}},
    )
    assert response.status_code == 200
    assert "bogus" not in response.json()["params_used"]


def test_standardize_flag_changes_the_outcome(client):
    points = [[x, x * 100.0] for x in range(30)]
    raw = client.post(
        "/api/cluster/dbscan",
        json={"points": points, "params": {"eps": 1.0, "min_pts": 3}, "standardize": False},
    ).json()
    scaled = client.post(
        "/api/cluster/dbscan",
        json={"points": points, "params": {"eps": 1.0, "min_pts": 3}, "standardize": True},
    ).json()
    assert raw["labels"] != scaled["labels"]


def test_compare_runs_all_three_on_one_dataset(client):
    points = blobs(client)
    response = client.post(
        "/api/cluster/compare",
        json={
            "points": points,
            "configs": {
                "dbscan": {"eps": 0.9, "min_pts": 5},
                "birch": {"threshold": 0.5, "branching_factor": 8, "n_clusters": 3},
                "cure": {"n_clusters": 3},
            },
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert set(body["results"]) == {"dbscan", "birch", "cure"}
    for result in body["results"].values():
        assert len(result["labels"]) == len(points)
        assert result["trace"]["steps"] == []  # compare mode never animates


def test_project_returns_two_dimensions_and_variance(client):
    points = [[float(i), float(i * 2), float(i % 3), float(i % 5)] for i in range(40)]
    response = client.post("/api/analysis/project", json={"points": points})
    body = response.json()
    assert response.status_code == 200
    assert len(body["projected"]) == 40
    assert len(body["projected"][0]) == 2
    assert len(body["explained_variance_ratio"]) == 2


def test_high_dimensional_clustering_projects_for_display(client):
    points = [[float(i), float(i * 2), float(i * 3), float(i % 4)] for i in range(40)]
    response = client.post(
        "/api/cluster/birch",
        json={"points": points, "params": {"threshold": 5.0, "n_clusters": 2}},
    )
    body = response.json()
    assert len(body["projection"]["points_2d"][0]) == 2
    assert body["projection"]["explained_variance_ratio"] is not None
```

- [ ] **Step 2: Run to verify it fails**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_api.py -v`
Expected: FAIL — 404s on every new route

- [ ] **Step 3: Implement `backend/app/schemas.py`**

```python
"""Request and response models. Validation lives here, not in the routes."""

from typing import Any

from pydantic import BaseModel, Field, field_validator


class GenerateRequest(BaseModel):
    kind: str
    n_samples: int = Field(default=300, ge=1, le=5000)
    noise: float = Field(default=0.05, ge=0.0, le=2.0)
    random_seed: int = 42


class PointsPayload(BaseModel):
    points: list[list[float]]

    @field_validator("points")
    @classmethod
    def validate_points(cls, value: list[list[float]]) -> list[list[float]]:
        """Reject empty, ragged, or non-finite point sets before they reach numpy."""
        import math

        if not value:
            raise ValueError("Provide at least one point.")
        width = len(value[0])
        if width == 0:
            raise ValueError("Points must have at least one feature.")
        for i, row in enumerate(value):
            if len(row) != width:
                raise ValueError(
                    f"Row {i} has {len(row)} value(s) but row 0 has {width}; "
                    "every point needs the same number of features."
                )
            for j, cell in enumerate(row):
                if cell is None or not math.isfinite(cell):
                    raise ValueError(f"Row {i}, column {j} is not a finite number.")
        return value


class ClusterRequest(PointsPayload):
    params: dict[str, Any] = Field(default_factory=dict)
    record_trace: bool = True
    max_steps: int = Field(default=5000, ge=10, le=100_000)
    standardize: bool = False


class CompareRequest(PointsPayload):
    configs: dict[str, dict[str, Any]] = Field(default_factory=dict)
    standardize: bool = False


class ProjectRequest(PointsPayload):
    n_components: int = Field(default=2, ge=1, le=10)
```

- [ ] **Step 4: Implement `backend/app/api/routes.py`**

```python
"""HTTP endpoints. These convert JSON to numpy, dispatch, and time the run."""

import time
from typing import Any

import numpy as np
from fastapi import APIRouter, File, UploadFile

from app.algorithms.birch import birch
from app.algorithms.cure import cure
from app.algorithms.dbscan import dbscan
from app.algorithms.trace import ClusterResult
from app.analysis.metrics import summarize
from app.analysis.projection import pca, standardize, to_display_2d
from app.data.generators import GENERATORS, generate
from app.data.ingest import parse_table
from app.errors import ApiError
from app.registry import ALGORITHMS
from app.schemas import ClusterRequest, CompareRequest, GenerateRequest, ProjectRequest

router = APIRouter(prefix="/api")

_IMPLEMENTATIONS = {"dbscan": dbscan, "birch": birch, "cure": cure}


def _clean_params(algorithm: str, raw: dict[str, Any]) -> dict[str, Any]:
    """Keep only parameters this algorithm declares, dropping empty optionals."""
    allowed = {param["name"] for param in ALGORITHMS[algorithm]["params"]}
    return {k: v for k, v in raw.items() if k in allowed and v is not None}


def run_algorithm(
    name: str,
    X: np.ndarray,
    params: dict[str, Any],
    record_trace: bool,
    max_steps: int,
) -> tuple[ClusterResult, dict[str, Any], float]:
    """Dispatch to one algorithm, returning (result, params_used, runtime_ms)."""
    if name not in _IMPLEMENTATIONS:
        raise ApiError(
            "unknown_algorithm",
            f"No algorithm named {name!r}. Expected dbscan, birch, or cure.",
            status=404,
        )

    cleaned = _clean_params(name, params)
    started = time.perf_counter()
    try:
        result = _IMPLEMENTATIONS[name](
            X, record_trace=record_trace, max_steps=max_steps, **cleaned
        )
    except ValueError as exc:
        raise ApiError("invalid_params", str(exc), status=422) from exc
    except TypeError as exc:
        raise ApiError("invalid_params", str(exc), status=422) from exc
    runtime_ms = (time.perf_counter() - started) * 1000.0
    return result, cleaned, runtime_ms


def _to_array(points: list[list[float]], apply_scaling: bool) -> np.ndarray:
    X = np.asarray(points, dtype=np.float64)
    return standardize(X) if apply_scaling else X


def _response_for(
    name: str, X: np.ndarray, result: ClusterResult, params: dict, runtime_ms: float
) -> dict[str, Any]:
    labels = np.asarray(result.labels)
    projected, ratio = to_display_2d(X)
    return {
        "algorithm": name,
        "labels": result.labels,
        "n_clusters": int(len([k for k in np.unique(labels) if k != -1])),
        "n_noise": int(np.sum(labels == -1)),
        "params_used": params,
        "runtime_ms": round(runtime_ms, 3),
        "metrics": summarize(X, labels),
        "projection": {
            "points_2d": projected.tolist(),
            "explained_variance_ratio": ratio,
        },
        "extras": result.extras,
        "trace": result.trace,
    }


@router.get("/algorithms")
def list_algorithms() -> dict[str, Any]:
    """Parameter schemas and theory for all three algorithms."""
    return {"algorithms": ALGORITHMS}


@router.get("/datasets/generators")
def list_generators() -> dict[str, Any]:
    """Available synthetic datasets and what each one demonstrates."""
    return {"generators": GENERATORS}


@router.post("/datasets/generate")
def generate_dataset(request: GenerateRequest) -> dict[str, Any]:
    """Produce a synthetic dataset with ground-truth labels for display."""
    try:
        points, truth = generate(
            request.kind, request.n_samples, request.noise, request.random_seed
        )
    except ValueError as exc:
        raise ApiError("unknown_generator", str(exc), field="kind", status=422) from exc

    return {
        "points": points.tolist(),
        "feature_names": ["x", "y"],
        "source_labels": [int(v) for v in truth],
    }


@router.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    """Parse an uploaded CSV or JSON file into a table the frontend owns."""
    content = await file.read()
    return parse_table(file.filename or "upload.csv", content)


@router.post("/cluster/compare")
def compare(request: CompareRequest) -> dict[str, Any]:
    """Run all three algorithms on one dataset. Never traces — results only."""
    X = _to_array(request.points, request.standardize)
    results: dict[str, Any] = {}
    for name in ("dbscan", "birch", "cure"):
        params = request.configs.get(name, {})
        result, used, runtime_ms = run_algorithm(name, X, params, False, 5000)
        results[name] = _response_for(name, X, result, used, runtime_ms)
    return {"results": results}


@router.post("/cluster/{algorithm}")
def cluster(algorithm: str, request: ClusterRequest) -> dict[str, Any]:
    """Run one algorithm, returning labels, metrics, projection, and a trace."""
    X = _to_array(request.points, request.standardize)
    result, used, runtime_ms = run_algorithm(
        algorithm, X, request.params, request.record_trace, request.max_steps
    )
    return _response_for(algorithm, X, result, used, runtime_ms)


@router.post("/analysis/project")
def project(request: ProjectRequest) -> dict[str, Any]:
    """PCA-project points for display, reporting how much variance is shown."""
    X = np.asarray(request.points, dtype=np.float64)
    projected, ratio = pca(X, n_components=request.n_components)
    return {
        "projected": projected.tolist(),
        "explained_variance_ratio": [float(v) for v in ratio],
    }
```

**Note on route order:** `/cluster/compare` is declared *before* `/cluster/{algorithm}`, otherwise FastAPI matches `compare` as an algorithm name.

- [ ] **Step 5: Mount the router and convert pydantic errors in `backend/app/main.py`**

Add these imports:

```python
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

from app.api.routes import router
```

Inside `create_app()`, after the existing `add_exception_handler` call:

```python
    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        """Render pydantic validation failures in the same envelope as ApiError."""
        first = exc.errors()[0] if exc.errors() else {}
        location = [str(part) for part in first.get("loc", []) if part != "body"]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_request",
                    "message": first.get("msg", "The request was not valid."),
                    "field": ".".join(location) or None,
                }
            },
        )

    app.include_router(router)
```

- [ ] **Step 6: Run to verify it passes**

Run: `backend\.venv\Scripts\python.exe -m pytest tests/test_api.py -v`
Expected: all passed

- [ ] **Step 7: Run the whole backend suite and start the server once by hand**

```powershell
backend\.venv\Scripts\python.exe -m pytest tests/ -v
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` and confirm all eight routes appear, then stop the server.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas.py backend/app/api backend/app/main.py backend/tests/test_api.py
git commit -m "feat: expose clustering, datasets, and analysis over HTTP"
```

---

## Task 12: Frontend scaffold and claymorphism tokens

**Files:**
- Create: `frontend/` (via Vite), `frontend/src/clay/tokens.css`, `frontend/src/index.css`, `frontend/vite.config.ts`, `frontend/.env.development`
- Modify: `frontend/src/main.tsx`, `frontend/src/App.tsx`
- Test: `frontend/src/clay/tokens.test.ts`

**Interfaces:**
- Produces: a running dev server on port 5173 that proxies `/api` to `localhost:8000`, and the full token set below available as CSS custom properties.

**Design note on claymorphism:** the look comes from *three* shadows on every surface, not one — a soft outer drop shadow for lift, an inner light highlight on the top-left, and an inner dark occlusion on the bottom-right. Pressed states swap the outer shadow for a deeper inset. Radii are large (18–32px) and backgrounds are low-saturation pastels. Getting these three layers right is the whole aesthetic; everything else follows.

- [ ] **Step 1: Scaffold the project**

```powershell
cd C:\Users\Eshunned\Projects\DWDM
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install zustand
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Configure Vite**

`frontend/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```

Add to `frontend/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Write the claymorphism tokens**

`frontend/src/clay/tokens.css`:

```css
:root {
  color-scheme: light;

  --clay-bg: #eef0f8;
  --clay-bg-deep: #e2e5f2;
  --clay-surface: #f4f5fb;
  --clay-surface-raised: #ffffff;
  --clay-surface-sunken: #e7eaf5;

  --clay-text: #2a2d45;
  --clay-text-muted: #6b7192;
  --clay-text-faint: #9298b8;

  --clay-accent: #7c6cf0;
  --clay-accent-soft: #ded9ff;
  --clay-accent-text: #ffffff;
  --clay-warn: #e8846b;
  --clay-good: #4fb08a;

  --clay-radius-sm: 14px;
  --clay-radius: 22px;
  --clay-radius-lg: 32px;

  --clay-light: rgba(255, 255, 255, 0.95);
  --clay-dark: rgba(84, 90, 130, 0.28);
  --clay-drop: rgba(84, 90, 130, 0.22);

  --clay-shadow:
    6px 6px 18px var(--clay-drop),
    inset 2px 2px 4px var(--clay-light),
    inset -3px -3px 7px var(--clay-dark);

  --clay-shadow-lg:
    12px 14px 34px var(--clay-drop),
    inset 3px 3px 6px var(--clay-light),
    inset -4px -5px 10px var(--clay-dark);

  --clay-shadow-pressed:
    inset 5px 5px 12px var(--clay-dark),
    inset -3px -3px 8px var(--clay-light);

  --clay-shadow-sunken:
    inset 4px 4px 10px var(--clay-dark),
    inset -2px -2px 6px var(--clay-light);

  --clay-ease: cubic-bezier(0.34, 1.3, 0.64, 1);
  --clay-fast: 130ms;
  --clay-slow: 220ms;
}

:root[data-theme="dark"] {
  color-scheme: dark;

  --clay-bg: #1c1f2e;
  --clay-bg-deep: #15182444;
  --clay-surface: #262a3d;
  --clay-surface-raised: #2f3448;
  --clay-surface-sunken: #1f2231;

  --clay-text: #eceefb;
  --clay-text-muted: #a5abc9;
  --clay-text-faint: #757c9d;

  --clay-accent: #9d90ff;
  --clay-accent-soft: #3a3560;
  --clay-accent-text: #12142a;

  --clay-light: rgba(255, 255, 255, 0.07);
  --clay-dark: rgba(0, 0, 0, 0.5);
  --clay-drop: rgba(0, 0, 0, 0.45);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --clay-fast: 0ms;
    --clay-slow: 0ms;
  }
}
```

`frontend/src/index.css`:

```css
@import "tailwindcss";
@import "./clay/tokens.css";

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  background: var(--clay-bg);
  color: var(--clay-text);
  font-family: "Nunito", "Quicksand", ui-rounded, "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

Import it in `frontend/src/main.tsx` and delete the Vite starter's `App.css`.

- [ ] **Step 4: Write the token test**

`frontend/src/clay/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");

const REQUIRED = [
  "--clay-bg",
  "--clay-surface",
  "--clay-surface-raised",
  "--clay-surface-sunken",
  "--clay-text",
  "--clay-text-muted",
  "--clay-accent",
  "--clay-good",
  "--clay-warn",
  "--clay-radius",
  "--clay-shadow",
  "--clay-shadow-lg",
  "--clay-shadow-pressed",
  "--clay-shadow-sunken",
];

describe("clay tokens", () => {
  it("declares every required token", () => {
    for (const token of REQUIRED) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("redefines the palette for the dark theme", () => {
    expect(css).toContain('[data-theme="dark"]');
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const token of ["--clay-bg", "--clay-surface", "--clay-text", "--clay-accent"]) {
      expect(darkBlock).toContain(`${token}:`);
    }
  });

  it("has no unparseable colour values", () => {
    const values = [...css.matchAll(/--clay-[a-z-]+:\s*([^;]+);/g)].map((m) => m[1].trim());
    for (const value of values) {
      expect(value).not.toMatch(/withheld|TODO|TBD/);
    }
  });

  it("layers three shadows so surfaces read as clay", () => {
    const shadow = css.match(/--clay-shadow:\s*([^;]+);/)?.[1] ?? "";
    expect(shadow.match(/inset/g)?.length).toBeGreaterThanOrEqual(2);
    expect(shadow).toMatch(/var\(--clay-drop\)/);
  });

  it("disables motion under prefers-reduced-motion", () => {
    expect(css).toContain("prefers-reduced-motion");
  });
});
```

- [ ] **Step 5: Run the test, fix the tripwire, run again**

Run: `npm test` from `frontend/`
Expected: the "no unparseable colour values" test FAILS until `--clay-good` is corrected to `#4fb08a`, then all 5 pass.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: scaffold frontend with claymorphism design tokens"
```

---

## Task 13: Clay component primitives

**Files:**
- Create: `frontend/src/clay/ClayCard.tsx`, `ClayButton.tsx`, `ClaySlider.tsx`, `ClayToggle.tsx`, `ClayTabs.tsx`, `ClaySelect.tsx`, `ClayBadge.tsx`, `index.ts`
- Test: `frontend/src/clay/clay.test.tsx`

**Interfaces produced** (every later task imports from `../../clay`):

```ts
ClayCard({ children, title?, subtitle?, tone?: "raised" | "sunken", className? })
ClayButton({ children, onClick?, variant?: "primary" | "ghost" | "danger", size?: "sm" | "md",
             disabled?, active?, title?, type? })
ClaySlider({ label, value, min, max, step, onChange: (v: number) => void, help?, disabled?,
             format?: (v: number) => string })
ClayToggle({ label, checked, onChange: (v: boolean) => void, help? })
ClayTabs({ tabs: { id: string; label: string }[], active: string, onChange: (id: string) => void })
ClaySelect({ label, value, options: { value: string; label: string }[],
             onChange: (v: string) => void, help? })
ClayBadge({ children, tone?: "neutral" | "accent" | "warn" | "good" })
```

- [ ] **Step 1: Write the failing test**

`frontend/src/clay/clay.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClayBadge, ClayButton, ClaySelect, ClaySlider, ClayTabs, ClayToggle } from ".";

describe("clay primitives", () => {
  it("ClayButton fires onClick and respects disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<ClayButton onClick={onClick}>Run</ClayButton>);
    fireEvent.click(screen.getByText("Run"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <ClayButton onClick={onClick} disabled>
        Run
      </ClayButton>,
    );
    fireEvent.click(screen.getByText("Run"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ClaySlider reports numbers, not strings", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={1} step={0.1} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("eps"), { target: { value: "0.7" } });
    expect(onChange).toHaveBeenCalledWith(0.7);
  });

  it("ClaySlider shows the current value in its editable field", () => {
    render(<ClaySlider label="eps" value={0.42} min={0} max={1} step={0.01} onChange={() => {}} />);
    expect((screen.getByLabelText("eps value") as HTMLInputElement).value).toBe("0.42");
  });

  it("ClaySlider accepts an exact typed value on blur", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "0.3" } });
    fireEvent.blur(field, { target: { value: "0.3" } });
    expect(onChange).toHaveBeenCalledWith(0.3);
  });

  it("ClaySlider commits a typed value on Enter", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "1.25" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(1.25);
  });

  it("ClaySlider does not fire onChange for every keystroke while typing", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    // "0." is not yet a value the user means; committing it mid-type would
    // clobber the field out from under them.
    fireEvent.change(screen.getByLabelText("eps value"), { target: { value: "0." } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ClaySlider clamps a typed value above the maximum", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "999" } });
    fireEvent.blur(field, { target: { value: "999" } });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("ClaySlider clamps a typed value below the minimum", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="minPts" value={5} min={1} max={50} step={1} onChange={onChange} />);
    const field = screen.getByLabelText("minPts value");
    fireEvent.change(field, { target: { value: "-4" } });
    fireEvent.blur(field, { target: { value: "-4" } });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("ClaySlider reverts junk input instead of reporting NaN", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "abc" } });
    fireEvent.blur(field, { target: { value: "abc" } });
    expect(onChange).not.toHaveBeenCalled();
    expect((field as HTMLInputElement).value).toBe("0.5");
  });

  it("ClayToggle flips its value", () => {
    const onChange = vi.fn();
    render(<ClayToggle label="Auto-run" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Auto-run"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ClayTabs marks the active tab and reports changes", () => {
    const onChange = vi.fn();
    render(
      <ClayTabs
        tabs={[
          { id: "a", label: "DBSCAN" },
          { id: "b", label: "BIRCH" },
        ]}
        active="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByText("DBSCAN").getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByText("BIRCH"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ClaySelect reports the chosen value", () => {
    const onChange = vi.fn();
    render(
      <ClaySelect
        label="Metric"
        value="euclidean"
        options={[
          { value: "euclidean", label: "Euclidean" },
          { value: "manhattan", label: "Manhattan" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Metric"), { target: { value: "manhattan" } });
    expect(onChange).toHaveBeenCalledWith("manhattan");
  });

  it("ClayBadge renders its children", () => {
    render(<ClayBadge tone="good">3 clusters</ClayBadge>);
    expect(screen.getByText("3 clusters")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, module `.` has no exports.

- [ ] **Step 3: Implement the primitives**

`frontend/src/clay/ClayCard.tsx`:

```tsx
import type { ReactNode } from "react";

export function ClayCard({
  children,
  title,
  subtitle,
  tone = "raised",
  className = "",
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  tone?: "raised" | "sunken";
  className?: string;
}) {
  return (
    <section
      className={`p-5 ${className}`}
      style={{
        background: tone === "sunken" ? "var(--clay-surface-sunken)" : "var(--clay-surface)",
        borderRadius: "var(--clay-radius-lg)",
        boxShadow: tone === "sunken" ? "var(--clay-shadow-sunken)" : "var(--clay-shadow)",
      }}
    >
      {title && (
        <header className="mb-3">
          <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--clay-text)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--clay-text-muted)" }}>
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
```

`frontend/src/clay/ClayButton.tsx`:

```tsx
import type { ReactNode } from "react";

const TONES = {
  primary: { background: "var(--clay-accent)", color: "var(--clay-accent-text)" },
  ghost: { background: "var(--clay-surface-raised)", color: "var(--clay-text)" },
  danger: { background: "var(--clay-warn)", color: "#fff" },
} as const;

export function ClayButton({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  disabled = false,
  active = false,
  title,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof TONES;
  size?: "sm" | "md";
  disabled?: boolean;
  active?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`font-bold tracking-tight select-none ${
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
      } ${disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer active:scale-[0.97]"}`}
      style={{
        ...TONES[variant],
        borderRadius: "var(--clay-radius-sm)",
        border: "none",
        boxShadow: active ? "var(--clay-shadow-pressed)" : "var(--clay-shadow)",
        transition: `transform var(--clay-fast) var(--clay-ease), box-shadow var(--clay-fast) ease`,
      }}
    >
      {children}
    </button>
  );
}
```

`frontend/src/clay/ClaySlider.tsx`:

**Design note:** the value readout is an editable number input, not a label. A
slider alone cannot hit an exact value like `ε = 0.30`, and exact values are what
make a result reproducible. While the user is mid-type the field holds a local
draft string (so `0.` and `-` do not get parsed and clobbered on every keystroke);
the draft commits on blur or Enter, clamped to the declared range, and junk input
reverts to the last good value.

```tsx
import { useState } from "react";

export function ClaySlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  help,
  disabled = false,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  help?: string;
  disabled?: boolean;
  format?: (value: number) => string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = format ? format(value) : String(Number(value.toFixed(4)));

  /** Commit a typed value: clamp into range, or revert if it is not a number. */
  function commit(raw: string) {
    setDraft(null);
    const parsed = Number(raw);
    if (raw.trim() === "" || Number.isNaN(parsed)) return;
    onChange(Math.min(max, Math.max(min, parsed)));
  }

  return (
    <label className="block mb-4" title={help}>
      <span className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-bold" style={{ color: "var(--clay-text)" }}>
          {label}
        </span>
        <input
          aria-label={`${label} value`}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={draft ?? shown}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
            }
          }}
          className="text-xs font-mono px-2 py-0.5 w-20 text-right"
          style={{
            color: "var(--clay-accent)",
            background: "var(--clay-surface-sunken)",
            border: "none",
            borderRadius: "8px",
            boxShadow: "var(--clay-shadow-sunken)",
          }}
        />
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full appearance-none h-3 cursor-pointer"
        style={{
          background: "var(--clay-surface-sunken)",
          borderRadius: "999px",
          boxShadow: "var(--clay-shadow-sunken)",
          accentColor: "var(--clay-accent)",
        }}
      />
      {help && (
        <span className="block text-[11px] mt-1 leading-snug" style={{ color: "var(--clay-text-faint)" }}>
          {help}
        </span>
      )}
    </label>
  );
}
```

`frontend/src/clay/ClayToggle.tsx`:

```tsx
export function ClayToggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  return (
    <label className="flex items-center gap-3 mb-3 cursor-pointer" title={help}>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className="relative inline-block w-11 h-6 shrink-0"
        style={{
          background: checked ? "var(--clay-accent)" : "var(--clay-surface-sunken)",
          borderRadius: "999px",
          boxShadow: "var(--clay-shadow-sunken)",
          transition: `background var(--clay-fast) ease`,
        }}
      >
        <span
          className="absolute top-1 w-4 h-4"
          style={{
            left: checked ? "26px" : "4px",
            background: "var(--clay-surface-raised)",
            borderRadius: "999px",
            boxShadow: "0 2px 5px var(--clay-drop)",
            transition: `left var(--clay-fast) var(--clay-ease)`,
          }}
        />
      </span>
      <span className="text-xs font-bold" style={{ color: "var(--clay-text)" }}>
        {label}
      </span>
    </label>
  );
}
```

`frontend/src/clay/ClayTabs.tsx`:

```tsx
export function ClayTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1.5 p-1.5"
      style={{
        background: "var(--clay-surface-sunken)",
        borderRadius: "var(--clay-radius)",
        boxShadow: "var(--clay-shadow-sunken)",
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className="flex-1 px-3 py-2 text-xs font-bold cursor-pointer"
            style={{
              background: selected ? "var(--clay-accent)" : "transparent",
              color: selected ? "var(--clay-accent-text)" : "var(--clay-text-muted)",
              border: "none",
              borderRadius: "var(--clay-radius-sm)",
              boxShadow: selected ? "var(--clay-shadow)" : "none",
              transition: `all var(--clay-fast) ease`,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```

`frontend/src/clay/ClaySelect.tsx`:

```tsx
export function ClaySelect({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <label className="block mb-4" title={help}>
      <span className="block text-xs font-bold mb-1.5" style={{ color: "var(--clay-text)" }}>
        {label}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2.5 text-sm cursor-pointer"
        style={{
          background: "var(--clay-surface-raised)",
          color: "var(--clay-text)",
          border: "none",
          borderRadius: "var(--clay-radius-sm)",
          boxShadow: "var(--clay-shadow)",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help && (
        <span className="block text-[11px] mt-1" style={{ color: "var(--clay-text-faint)" }}>
          {help}
        </span>
      )}
    </label>
  );
}
```

`frontend/src/clay/ClayBadge.tsx`:

```tsx
import type { ReactNode } from "react";

const TONES = {
  neutral: { background: "var(--clay-surface-sunken)", color: "var(--clay-text-muted)" },
  accent: { background: "var(--clay-accent-soft)", color: "var(--clay-accent)" },
  warn: { background: "var(--clay-warn)", color: "#fff" },
  good: { background: "var(--clay-good)", color: "#fff" },
} as const;

export function ClayBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className="inline-block px-2.5 py-1 text-[11px] font-bold"
      style={{ ...TONES[tone], borderRadius: "999px" }}
    >
      {children}
    </span>
  );
}
```

`frontend/src/clay/index.ts`:

```ts
export { ClayBadge } from "./ClayBadge";
export { ClayButton } from "./ClayButton";
export { ClayCard } from "./ClayCard";
export { ClaySelect } from "./ClaySelect";
export { ClaySlider } from "./ClaySlider";
export { ClayTabs } from "./ClayTabs";
export { ClayToggle } from "./ClayToggle";
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` — all clay tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/clay
git commit -m "feat: add claymorphism component primitives"
```

---

## Task 14: Types, API client, and application store

**Files:**
- Create: `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`, `frontend/src/store/appStore.ts`
- Test: `frontend/src/lib/api.test.ts`

**Interfaces produced:**

```ts
// types.ts
export type AlgorithmKey = "dbscan" | "birch" | "cure";
export interface ParamSpec { name: string; label: string; type: "float" | "int" | "choice" | "bool";
  default: number | string | boolean | null; min?: number; max?: number; step?: number;
  options?: string[]; help: string }
export interface Theory { summary: string; how_it_works: string[];
  parameters: Record<string, string>; complexity: string; strengths: string[]; weaknesses: string[] }
export interface AlgorithmSpec { key: AlgorithmKey; label: string; tagline: string;
  params: ParamSpec[]; theory: Theory }
export interface TraceStep { i: number; kind: string; narration: string;
  labels_delta: Record<string, number>; payload: Record<string, unknown>;
  significant: boolean; labels_snapshot: number[] | null }
export interface Trace { steps: TraceStep[]; truncated: boolean; sample_rate: number }
export interface Metrics { silhouette: number | null; davies_bouldin: number | null;
  n_clusters: number; n_noise: number; cluster_sizes: Record<string, number> }
export interface ClusterResponse { algorithm: AlgorithmKey; labels: number[]; n_clusters: number;
  n_noise: number; params_used: Record<string, unknown>; runtime_ms: number; metrics: Metrics;
  projection: { points_2d: number[][]; explained_variance_ratio: number[] | null };
  extras: Record<string, unknown>; trace: Trace }
export interface ParsedTable { columns: string[]; dtypes: ("numeric" | "text")[];
  rows: (number | string | null)[][]; n_rows: number; suggested_features: string[] }
export interface GeneratorSpec { key: string; label: string; hint: string; supports_noise: boolean }

// api.ts — every function throws ApiClientError on a non-2xx response
export class ApiClientError extends Error { code: string; field: string | null }
export const api: {
  health(): Promise<boolean>;
  algorithms(): Promise<Record<AlgorithmKey, AlgorithmSpec>>;
  generators(): Promise<Record<string, GeneratorSpec>>;
  generate(body: { kind: string; n_samples: number; noise: number; random_seed: number }):
    Promise<{ points: number[][]; feature_names: string[]; source_labels: number[] }>;
  upload(file: File): Promise<ParsedTable>;
  cluster(algorithm: AlgorithmKey, body: { points: number[][]; params: Record<string, unknown>;
    record_trace: boolean; max_steps?: number; standardize?: boolean }): Promise<ClusterResponse>;
  compare(body: { points: number[][]; configs: Record<string, Record<string, unknown>>;
    standardize?: boolean }): Promise<Record<AlgorithmKey, ClusterResponse>>;
};
```

The store (`useAppStore`) holds: `points`, `featureNames`, `sourceLabels`, `algorithm`, `params` (per algorithm), `results` (per algorithm), `compareResults`, `playhead`, `isPlaying`, `speed`, `autoRun`, `standardize`, `recordTrace`, `theme`, `backendOk`, `error`, plus the setters each later task needs.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, api } from "./api";

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("posts points and params to the right cluster URL", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ algorithm: "dbscan", labels: [0] }));

    await api.cluster("dbscan", {
      points: [[0, 0]],
      params: { eps: 0.5 },
      record_trace: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/cluster/dbscan");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      points: [[0, 0]],
      params: { eps: 0.5 },
      record_trace: true,
    });
  });

  it("unwraps the error envelope into ApiClientError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ error: { code: "invalid_params", message: "eps must be > 0", field: "eps" } }, 422),
    );

    await expect(
      api.cluster("dbscan", { points: [[0, 0]], params: {}, record_trace: false }),
    ).rejects.toMatchObject({ code: "invalid_params", message: "eps must be > 0", field: "eps" });
  });

  it("falls back to a readable message when the body is not an envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse("boom", 500));
    await expect(api.algorithms()).rejects.toBeInstanceOf(ApiClientError);
  });

  it("health returns false instead of throwing when the backend is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await api.health()).toBe(false);
  });

  it("unwraps the algorithms envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ algorithms: { dbscan: { key: "dbscan" } } }),
    );
    const result = await api.algorithms();
    expect(result.dbscan.key).toBe("dbscan");
  });

  it("uploads a file as multipart form data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ columns: ["x"], rows: [], n_rows: 0 }));
    await api.upload(new File(["x\n1\n"], "d.csv", { type: "text/csv" }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/datasets/upload");
    expect(init?.body).toBeInstanceOf(FormData);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, `./api` not found.

- [ ] **Step 3: Implement `frontend/src/lib/api.ts`**

```ts
import type {
  AlgorithmKey,
  AlgorithmSpec,
  ClusterResponse,
  GeneratorSpec,
  ParsedTable,
} from "./types";

export class ApiClientError extends Error {
  code: string;
  field: string | null;

  constructor(message: string, code = "request_failed", field: string | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.field = field;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiClientError(
      "Cannot reach the backend. Is it running on port 8000?",
      "unreachable",
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const envelope = (body as { error?: { code: string; message: string; field: string | null } })
      ?.error;
    throw new ApiClientError(
      envelope?.message ?? `Request to ${url} failed with status ${response.status}.`,
      envelope?.code ?? "request_failed",
      envelope?.field ?? null,
    );
  }
  return body as T;
}

function postJson<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const api = {
  async health(): Promise<boolean> {
    try {
      const body = await request<{ status: string }>("/api/health");
      return body.status === "ok";
    } catch {
      return false;
    }
  },

  async algorithms(): Promise<Record<AlgorithmKey, AlgorithmSpec>> {
    const body = await request<{ algorithms: Record<AlgorithmKey, AlgorithmSpec> }>(
      "/api/algorithms",
    );
    return body.algorithms;
  },

  async generators(): Promise<Record<string, GeneratorSpec>> {
    const body = await request<{ generators: Record<string, GeneratorSpec> }>(
      "/api/datasets/generators",
    );
    return body.generators;
  },

  generate(body: { kind: string; n_samples: number; noise: number; random_seed: number }) {
    return postJson<{ points: number[][]; feature_names: string[]; source_labels: number[] }>(
      "/api/datasets/generate",
      body,
    );
  },

  upload(file: File): Promise<ParsedTable> {
    const form = new FormData();
    form.append("file", file);
    return request<ParsedTable>("/api/datasets/upload", { method: "POST", body: form });
  },

  cluster(
    algorithm: AlgorithmKey,
    body: {
      points: number[][];
      params: Record<string, unknown>;
      record_trace: boolean;
      max_steps?: number;
      standardize?: boolean;
    },
  ): Promise<ClusterResponse> {
    return postJson<ClusterResponse>(`/api/cluster/${algorithm}`, body);
  },

  async compare(body: {
    points: number[][];
    configs: Record<string, Record<string, unknown>>;
    standardize?: boolean;
  }): Promise<Record<AlgorithmKey, ClusterResponse>> {
    const result = await postJson<{ results: Record<AlgorithmKey, ClusterResponse> }>(
      "/api/cluster/compare",
      body,
    );
    return result.results;
  },
};
```

Write `frontend/src/lib/types.ts` with exactly the interfaces listed in this task's Interfaces block.

- [ ] **Step 4: Implement `frontend/src/store/appStore.ts`**

```ts
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

  setPoints: (points: number[][], featureNames: string[], sourceLabels: number[] | null, name: string) => void;
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

/** Results and the playhead are stale the moment the data changes. */
const CLEARED = { results: {}, compareResults: null, playhead: 0, isPlaying: false };

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
  addPoint: (point) => set((s) => ({ points: [...s.points, point], sourceLabels: null, ...CLEARED })),
  movePoint: (index, point) =>
    set((s) => ({ points: s.points.map((p, i) => (i === index ? point : p)), ...CLEARED })),
  removePoint: (index) =>
    set((s) => ({ points: s.points.filter((_, i) => i !== index), sourceLabels: null, ...CLEARED })),
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
    set((s) => ({ params: { ...s.params, [algorithm]: { ...s.params[algorithm], [name]: value } } })),

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
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test` — all api tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib frontend/src/store
git commit -m "feat: add typed api client and application store"
```

---

## Task 15: Colours, the data-to-screen transform, and ScatterCanvas

**Files:**
- Create: `frontend/src/lib/colors.ts`, `frontend/src/features/viz/transform.ts`, `frontend/src/features/viz/ScatterCanvas.tsx`
- Test: `frontend/src/features/viz/transform.test.ts`

**Interfaces produced:**

```ts
// colors.ts
export const CLUSTER_PALETTE: string[];       // 12 hues, distinguishable in both themes
export function clusterColor(label: number): string;   // label -1 -> NOISE_COLOR
export const NOISE_COLOR: string;

// transform.ts
export interface Transform {
  toScreen(x: number, y: number): [number, number];
  toData(sx: number, sy: number): [number, number];
  scale: number;
}
export function makeTransform(points: number[][], width: number, height: number,
                              padding?: number): Transform;

// ScatterCanvas.tsx
export interface Overlay { (ctx: CanvasRenderingContext2D, t: Transform): void }
export function ScatterCanvas(props: {
  points: number[][];                  // already 2-D (projected upstream)
  labels: number[];
  pointTypes?: string[];               // DBSCAN core/border/noise
  overlay?: Overlay;
  editable?: boolean;
  onAddPoint?: (point: [number, number]) => void;
  onMovePoint?: (index: number, point: [number, number]) => void;
  onRemovePoint?: (index: number) => void;
  height?: number;
  caption?: string;                    // drawn onto the canvas, so PNG exports carry it
}): JSX.Element;
```

**Design note:** the transform is a pure function with no React or canvas dependency, which is why it is the piece with real unit tests. It preserves aspect ratio by using a single scale for both axes — otherwise circular eps-neighbourhoods would render as ellipses and the DBSCAN overlay would lie about what the algorithm did. Degenerate ranges (every point identical, or a single point) fall back to scale 1 centred on the point rather than dividing by zero.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/viz/transform.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { makeTransform } from "./transform";

describe("makeTransform", () => {
  it("round-trips data through screen space", () => {
    const t = makeTransform(
      [
        [0, 0],
        [10, 10],
      ],
      400,
      400,
      20,
    );
    const [sx, sy] = t.toScreen(5, 5);
    const [x, y] = t.toData(sx, sy);
    expect(x).toBeCloseTo(5, 6);
    expect(y).toBeCloseTo(5, 6);
  });

  it("uses one scale for both axes so circles stay circular", () => {
    const t = makeTransform(
      [
        [0, 0],
        [10, 1],
      ],
      400,
      400,
      20,
    );
    const [x0] = t.toScreen(0, 0);
    const [x1] = t.toScreen(1, 0);
    const [, y0] = t.toScreen(0, 0);
    const [, y1] = t.toScreen(0, 1);
    expect(Math.abs(x1 - x0)).toBeCloseTo(Math.abs(y1 - y0), 6);
  });

  it("flips the y axis so larger values appear higher", () => {
    const t = makeTransform(
      [
        [0, 0],
        [10, 10],
      ],
      400,
      400,
      20,
    );
    const [, low] = t.toScreen(0, 0);
    const [, high] = t.toScreen(0, 10);
    expect(high).toBeLessThan(low);
  });

  it("keeps every point inside the padded box", () => {
    const points = [
      [-5, -5],
      [5, 5],
      [0, 3],
    ];
    const t = makeTransform(points, 300, 200, 15);
    for (const [x, y] of points) {
      const [sx, sy] = t.toScreen(x, y);
      expect(sx).toBeGreaterThanOrEqual(15 - 1e-6);
      expect(sx).toBeLessThanOrEqual(285 + 1e-6);
      expect(sy).toBeGreaterThanOrEqual(15 - 1e-6);
      expect(sy).toBeLessThanOrEqual(185 + 1e-6);
    }
  });

  it("handles a single point without NaN", () => {
    const t = makeTransform([[3, 4]], 400, 400, 20);
    const [sx, sy] = t.toScreen(3, 4);
    expect(Number.isFinite(sx)).toBe(true);
    expect(Number.isFinite(sy)).toBe(true);
  });

  it("handles identical points without NaN", () => {
    const t = makeTransform(
      [
        [2, 2],
        [2, 2],
        [2, 2],
      ],
      400,
      400,
      20,
    );
    const [sx, sy] = t.toScreen(2, 2);
    expect(Number.isFinite(sx)).toBe(true);
    expect(Number.isFinite(sy)).toBe(true);
    expect(t.scale).toBeGreaterThan(0);
  });

  it("handles an empty point set without NaN", () => {
    const t = makeTransform([], 400, 400, 20);
    const [sx, sy] = t.toScreen(0, 0);
    expect(Number.isFinite(sx)).toBe(true);
    expect(Number.isFinite(sy)).toBe(true);
  });

  it("exposes the scale so overlays can size radii in screen units", () => {
    const t = makeTransform(
      [
        [0, 0],
        [10, 10],
      ],
      420,
      420,
      10,
    );
    expect(t.scale).toBeCloseTo(40, 6);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, `./transform` not found.

- [ ] **Step 3: Implement `frontend/src/features/viz/transform.ts`**

```ts
export interface Transform {
  toScreen(x: number, y: number): [number, number];
  toData(sx: number, sy: number): [number, number];
  /** Screen pixels per data unit. Overlays use this to size radii. */
  scale: number;
}

/**
 * Build a transform that fits `points` into a padded box.
 *
 * Both axes share one scale, so a circle in data space stays a circle on
 * screen — the DBSCAN eps overlay depends on that being true.
 */
export function makeTransform(
  points: number[][],
  width: number,
  height: number,
  padding = 24,
): Transform {
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    const x = point[0] ?? 0;
    const y = point[1] ?? 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minY = -1;
    maxY = 1;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // A degenerate span would divide by zero; fall back to a unit window.
  const safeSpanX = spanX > 1e-12 ? spanX : 1;
  const safeSpanY = spanY > 1e-12 ? spanY : 1;

  const scale = Math.min(innerWidth / safeSpanX, innerHeight / safeSpanY);

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const originX = width / 2 - centreX * scale;
  const originY = height / 2 + centreY * scale;

  return {
    scale,
    toScreen(x, y) {
      return [originX + x * scale, originY - y * scale];
    },
    toData(sx, sy) {
      return [(sx - originX) / scale, (originY - sy) / scale];
    },
  };
}
```

- [ ] **Step 4: Implement `frontend/src/lib/colors.ts`**

```ts
/**
 * A categorical palette chosen to stay distinguishable in both themes and under
 * common colour-vision deficiencies. Hues are spaced unevenly on purpose: the
 * green-to-red region is thinned out because that is where deuteranopia and
 * protanopia collapse distinctions.
 */
export const CLUSTER_PALETTE = [
  "#6c7ff2",
  "#e8845f",
  "#3fb99a",
  "#c86bd4",
  "#e0b23c",
  "#4aa5d8",
  "#e0648f",
  "#7fb542",
  "#9b7ae0",
  "#d97a3c",
  "#42bdc4",
  "#b5568c",
];

export const NOISE_COLOR = "#9298b8";

/** The fill colour for a label. Noise (-1) always renders in grey. */
export function clusterColor(label: number): string {
  if (label < 0) return NOISE_COLOR;
  return CLUSTER_PALETTE[label % CLUSTER_PALETTE.length];
}
```

- [ ] **Step 5: Implement `frontend/src/features/viz/ScatterCanvas.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";

import { NOISE_COLOR, clusterColor } from "../../lib/colors";
import { type Transform, makeTransform } from "./transform";

export type Overlay = (ctx: CanvasRenderingContext2D, t: Transform) => void;

const HIT_RADIUS = 10;

export function ScatterCanvas({
  points,
  labels,
  pointTypes,
  overlay,
  editable = false,
  onAddPoint,
  onMovePoint,
  onRemovePoint,
  height = 520,
  caption,
}: {
  points: number[][];
  labels: number[];
  pointTypes?: string[];
  overlay?: Overlay;
  editable?: boolean;
  onAddPoint?: (point: [number, number]) => void;
  onMovePoint?: (index: number, point: [number, number]) => void;
  onRemovePoint?: (index: number) => void;
  height?: number;
  caption?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);
  const dragRef = useRef<number | null>(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const transform = makeTransform(points, width, height, 34);

    // Overlays draw underneath the points so they never hide the data.
    if (overlay) {
      ctx.save();
      overlay(ctx, transform);
      ctx.restore();
    }

    for (let i = 0; i < points.length; i += 1) {
      const [sx, sy] = transform.toScreen(points[i][0], points[i][1]);
      const label = labels[i] ?? -1;
      const kind = pointTypes?.[i];

      ctx.beginPath();
      ctx.arc(sx, sy, label < 0 ? 3 : 4.5, 0, Math.PI * 2);

      if (label < 0) {
        // Noise stays hollow so it reads as excluded rather than as a 13th cluster.
        ctx.strokeStyle = NOISE_COLOR;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        ctx.fillStyle = clusterColor(label);
        ctx.fill();
        if (kind === "core") {
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }
    }
  }, [points, labels, pointTypes, overlay, width, height]);

  function locate(event: React.MouseEvent<HTMLCanvasElement>): {
    transform: Transform;
    sx: number;
    sy: number;
    hit: number | null;
  } {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const transform = makeTransform(points, width, height, 34);

    let hit: number | null = null;
    let best = HIT_RADIUS;
    for (let i = 0; i < points.length; i += 1) {
      const [px, py] = transform.toScreen(points[i][0], points[i][1]);
      const distance = Math.hypot(px - sx, py - sy);
      if (distance < best) {
        best = distance;
        hit = i;
      }
    }
    return { transform, sx, sy, hit };
  }

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: "var(--clay-radius-lg)",
          background: "var(--clay-surface-sunken)",
          boxShadow: "var(--clay-shadow-sunken)",
          cursor: editable ? "crosshair" : "default",
          display: "block",
        }}
        onContextMenu={(event) => {
          if (!editable) return;
          event.preventDefault();
          const { hit } = locate(event);
          if (hit !== null) onRemovePoint?.(hit);
        }}
        onMouseDown={(event) => {
          if (!editable || event.button !== 0) return;
          const { hit } = locate(event);
          if (hit !== null && (event.altKey || event.metaKey)) {
            onRemovePoint?.(hit);
            return;
          }
          if (hit !== null) dragRef.current = hit;
        }}
        onMouseMove={(event) => {
          if (!editable || dragRef.current === null) return;
          const { transform, sx, sy } = locate(event);
          onMovePoint?.(dragRef.current, transform.toData(sx, sy));
        }}
        onMouseUp={(event) => {
          if (!editable) return;
          const wasDragging = dragRef.current !== null;
          dragRef.current = null;
          if (wasDragging) return;
          const { transform, sx, sy, hit } = locate(event);
          if (hit === null) onAddPoint?.(transform.toData(sx, sy));
        }}
        onMouseLeave={() => {
          dragRef.current = null;
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test` — all transform tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/colors.ts frontend/src/features/viz
git commit -m "feat: add scatter canvas, transform, and cluster palette"
```

---

## Task 16: Trace replay and the transport bar

**Files:**
- Create: `frontend/src/lib/trace.ts`, `frontend/src/features/viz/TracePlayer.tsx`
- Test: `frontend/src/lib/trace.test.ts`

**Interfaces produced:**

```ts
// trace.ts
export function labelsAt(steps: TraceStep[], upTo: number, pointCount: number): number[];
export function narrationLog(steps: TraceStep[], upTo: number, limit?: number): string[];

// TracePlayer.tsx
export function TracePlayer(props: { steps: TraceStep[]; truncated: boolean; sampleRate: number }): JSX.Element;
```

**Design note:** `labelsAt` seeks backwards efficiently by starting from the nearest keyframe at or before `upTo` rather than replaying from zero, which is what makes scrubbing smooth on a 5000-step trace. Playback uses `requestAnimationFrame` with a time accumulator so that changing speed mid-play does not jump the playhead, and so the animation runs at the same rate on a 60Hz and a 144Hz display.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/trace.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { labelsAt, narrationLog } from "./trace";
import type { TraceStep } from "./types";

function step(i: number, delta: Record<string, number>, snapshot: number[] | null = null): TraceStep {
  return {
    i,
    kind: "assign",
    narration: `step ${i}`,
    labels_delta: delta,
    payload: {},
    significant: false,
    labels_snapshot: snapshot,
  };
}

describe("labelsAt", () => {
  it("returns all unassigned before the first step", () => {
    expect(labelsAt([step(0, { "0": 1 })], -1, 3)).toEqual([-1, -1, -1]);
  });

  it("accumulates deltas up to and including the playhead", () => {
    const steps = [step(0, { "0": 0 }), step(1, { "1": 1 }), step(2, { "2": 0 })];
    expect(labelsAt(steps, 1, 3)).toEqual([0, 1, -1]);
    expect(labelsAt(steps, 2, 3)).toEqual([0, 1, 0]);
  });

  it("lets a later delta overwrite an earlier one", () => {
    const steps = [step(0, { "0": 0 }), step(1, { "0": 5 })];
    expect(labelsAt(steps, 1, 1)).toEqual([5]);
  });

  it("seeks backwards using the nearest keyframe", () => {
    const steps = [
      step(0, { "0": 0 }, [0, -1, -1]),
      step(1, { "1": 1 }),
      step(2, { "2": 2 }, [0, 1, 2]),
      step(3, { "0": 9 }),
    ];
    // Asking for 2 must equal the keyframe exactly, not a stale prefix.
    expect(labelsAt(steps, 2, 3)).toEqual([0, 1, 2]);
    expect(labelsAt(steps, 3, 3)).toEqual([9, 1, 2]);
  });

  it("clamps a playhead past the end to the final state", () => {
    const steps = [step(0, { "0": 0 }), step(1, { "1": 1 })];
    expect(labelsAt(steps, 99, 2)).toEqual([0, 1]);
  });

  it("returns unassigned labels for an empty trace", () => {
    expect(labelsAt([], 5, 2)).toEqual([-1, -1]);
  });

  it("produces the same result seeking forward and backward", () => {
    const steps = Array.from({ length: 60 }, (_, i) =>
      step(i, { [String(i % 10)]: i % 4 }, i % 20 === 0 ? null : null),
    );
    const forward = labelsAt(steps, 45, 10);
    const backward = labelsAt(steps, 45, 10);
    expect(forward).toEqual(backward);
  });
});

describe("narrationLog", () => {
  it("returns the most recent lines ending at the playhead", () => {
    const steps = [step(0, {}), step(1, {}), step(2, {}), step(3, {})];
    expect(narrationLog(steps, 3, 2)).toEqual(["step 2", "step 3"]);
  });

  it("is empty before the trace starts", () => {
    expect(narrationLog([step(0, {})], -1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, `./trace` not found.

- [ ] **Step 3: Implement `frontend/src/lib/trace.ts`**

```ts
import type { TraceStep } from "./types";

/**
 * The label assignment after replaying every step up to and including `upTo`.
 *
 * Replay starts from the nearest keyframe at or before the playhead rather than
 * from step zero, so dragging the scrubber backwards stays cheap even on a
 * long trace.
 */
export function labelsAt(steps: TraceStep[], upTo: number, pointCount: number): number[] {
  const labels = new Array<number>(pointCount).fill(-1);
  if (steps.length === 0 || upTo < 0) return labels;

  const end = Math.min(upTo, steps.length - 1);

  let start = 0;
  for (let i = end; i >= 0; i -= 1) {
    const snapshot = steps[i].labels_snapshot;
    if (snapshot) {
      for (let j = 0; j < pointCount; j += 1) labels[j] = snapshot[j] ?? -1;
      start = i + 1;
      break;
    }
  }

  for (let i = start; i <= end; i += 1) {
    const delta = steps[i].labels_delta;
    for (const key in delta) labels[Number(key)] = delta[key];
  }
  return labels;
}

/** The last `limit` narration lines ending at the playhead, oldest first. */
export function narrationLog(steps: TraceStep[], upTo: number, limit = 6): string[] {
  if (steps.length === 0 || upTo < 0) return [];
  const end = Math.min(upTo, steps.length - 1);
  return steps.slice(Math.max(0, end - limit + 1), end + 1).map((step) => step.narration);
}
```

- [ ] **Step 4: Implement `frontend/src/features/viz/TracePlayer.tsx`**

```tsx
import { useEffect, useRef } from "react";

import { ClayBadge, ClayButton } from "../../clay";
import { useAppStore } from "../../store/appStore";
import type { TraceStep } from "../../lib/types";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
const BASE_STEPS_PER_SECOND = 6;

export function TracePlayer({
  steps,
  truncated,
  sampleRate,
}: {
  steps: TraceStep[];
  truncated: boolean;
  sampleRate: number;
}) {
  const { playhead, isPlaying, speed, setPlayhead, setPlaying, setSpeed } = useAppStore();
  const frameRef = useRef<number | null>(null);
  const carryRef = useRef(0);
  const lastRef = useRef(0);

  const total = steps.length;
  const atEnd = playhead >= total - 1;

  useEffect(() => {
    if (!isPlaying || total === 0) return;

    lastRef.current = performance.now();
    carryRef.current = 0;

    const tick = (now: number) => {
      // A time accumulator keeps playback frame-rate independent, so the
      // animation runs at the same speed on a 60Hz and a 144Hz display.
      const elapsed = (now - lastRef.current) / 1000;
      lastRef.current = now;
      carryRef.current += elapsed * BASE_STEPS_PER_SECOND * speed;

      const advance = Math.floor(carryRef.current);
      if (advance >= 1) {
        carryRef.current -= advance;
        const next = useAppStore.getState().playhead + advance;
        if (next >= total - 1) {
          setPlayhead(total - 1);
          setPlaying(false);
          return;
        }
        setPlayhead(next);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, speed, total, setPlayhead, setPlaying]);

  if (total === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
        No trace recorded. Enable step recording and re-run to animate this algorithm.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ClayButton
          size="sm"
          variant="primary"
          onClick={() => {
            if (atEnd) setPlayhead(0);
            setPlaying(!isPlaying);
          }}
        >
          {isPlaying ? "Pause" : atEnd ? "Replay" : "Play"}
        </ClayButton>
        <ClayButton size="sm" onClick={() => setPlayhead(Math.max(0, playhead - 1))} title="Step back">
          Back
        </ClayButton>
        <ClayButton
          size="sm"
          onClick={() => setPlayhead(Math.min(total - 1, playhead + 1))}
          title="Step forward"
        >
          Step
        </ClayButton>
        <ClayButton size="sm" onClick={() => setPlayhead(total - 1)} title="Jump to the end">
          End
        </ClayButton>

        <span className="flex gap-1 ml-auto">
          {SPEEDS.map((value) => (
            <ClayButton
              key={value}
              size="sm"
              active={speed === value}
              onClick={() => setSpeed(value)}
            >
              {value}x
            </ClayButton>
          ))}
        </span>
      </div>

      <input
        aria-label="Playhead"
        type="range"
        min={0}
        max={total - 1}
        step={1}
        value={playhead}
        onChange={(event) => {
          setPlaying(false);
          setPlayhead(Number(event.target.value));
        }}
        className="w-full h-3 cursor-pointer"
        style={{
          background: "var(--clay-surface-sunken)",
          borderRadius: "999px",
          boxShadow: "var(--clay-shadow-sunken)",
          accentColor: "var(--clay-accent)",
        }}
      />

      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--clay-text-muted)" }}>
        <span className="font-mono">
          step {playhead + 1} / {total}
        </span>
        {truncated && (
          <ClayBadge tone="warn">
            sampled 1 in {sampleRate} — the run was longer than the step budget
          </ClayBadge>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test` — all trace tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/trace.ts frontend/src/features/viz/TracePlayer.tsx
git commit -m "feat: add trace replay and transport bar"
```

---

## Task 17: Per-algorithm canvas overlays

**Files:**
- Create: `frontend/src/features/viz/overlays/dbscan.ts`, `birch.ts`, `cure.ts`, `index.ts`
- Test: `frontend/src/features/viz/overlays/overlays.test.ts`

**Interfaces produced:**

```ts
export function dbscanOverlay(step: TraceStep | null, points: number[][]): Overlay;
export function birchOverlay(step: TraceStep | null, points: number[][]): Overlay;
export function cureOverlay(step: TraceStep | null, points: number[][], progress: number): Overlay;
export function overlayFor(algorithm: AlgorithmKey, step: TraceStep | null,
                           points: number[][], progress: number): Overlay;
```

Every overlay returns a no-op draw function when `step` is null, so the canvas never needs to branch.

**Design note:** overlays draw in *data* space converted through the transform, never in raw pixels — that is why `Transform.scale` exists. The DBSCAN eps circle must be drawn with radius `eps * t.scale`; drawing it with a fixed pixel radius would show the user a circle that has nothing to do with the parameter they set. This is the single most important correctness detail in the visualisation.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/viz/overlays/overlays.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import type { TraceStep } from "../../../lib/types";
import { makeTransform } from "../transform";
import { birchOverlay, cureOverlay, dbscanOverlay, overlayFor } from ".";

function fakeContext() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

const points = [
  [0, 0],
  [1, 1],
  [2, 2],
];
const transform = makeTransform(points, 400, 400, 20);

function step(kind: string, payload: Record<string, unknown>): TraceStep {
  return {
    i: 0,
    kind,
    narration: "",
    labels_delta: {},
    payload,
    significant: false,
    labels_snapshot: null,
  };
}

describe("overlays", () => {
  it("all overlays no-op on a null step", () => {
    for (const overlay of [
      dbscanOverlay(null, points),
      birchOverlay(null, points),
      cureOverlay(null, points, 0),
    ]) {
      const ctx = fakeContext();
      overlay(ctx, transform);
      expect(ctx.arc).not.toHaveBeenCalled();
    }
  });

  it("dbscan draws the eps circle scaled by the transform, not in fixed pixels", () => {
    const ctx = fakeContext();
    dbscanOverlay(step("visit", { point: 0, eps_circle: { center: [0, 0], radius: 0.5 }, neighbors: [1] }), points)(
      ctx,
      transform,
    );
    const [, , radius] = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(radius).toBeCloseTo(0.5 * transform.scale, 6);
  });

  it("dbscan links the current point to each neighbour", () => {
    const ctx = fakeContext();
    dbscanOverlay(
      step("visit", { point: 0, eps_circle: { center: [0, 0], radius: 0.5 }, neighbors: [1, 2] }),
      points,
    )(ctx, transform);
    expect((ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it("dbscan tolerates a step with no eps circle", () => {
    const ctx = fakeContext();
    expect(() => dbscanOverlay(step("noise", { point: 1 }), points)(ctx, transform)).not.toThrow();
  });

  it("birch draws one circle per cf entry", () => {
    const ctx = fakeContext();
    birchOverlay(
      step("absorb", {
        tree: {
          root: 0,
          nodes: [
            {
              id: 0,
              parent: null,
              is_leaf: true,
              entries: [
                { n: 3, centroid: [0, 0], radius: 0.4, child: null },
                { n: 2, centroid: [2, 2], radius: 0.2, child: null },
              ],
            },
          ],
        },
      }),
      points,
    )(ctx, transform);
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it("birch scales entry radii through the transform", () => {
    const ctx = fakeContext();
    birchOverlay(
      step("absorb", {
        tree: {
          root: 0,
          nodes: [
            { id: 0, parent: null, is_leaf: true, entries: [{ n: 1, centroid: [0, 0], radius: 0.75, child: null }] },
          ],
        },
      }),
      points,
    )(ctx, transform);
    const [, , radius] = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(radius).toBeCloseTo(0.75 * transform.scale, 6);
  });

  it("cure tweens representatives between before and after by progress", () => {
    const before = [[0, 0]];
    const after = [[2, 2]];
    const ctxStart = fakeContext();
    cureOverlay(step("shrink", { reps_before: before, reps_after: after, centroid: [1, 1] }), points, 0)(
      ctxStart,
      transform,
    );
    const ctxEnd = fakeContext();
    cureOverlay(step("shrink", { reps_before: before, reps_after: after, centroid: [1, 1] }), points, 1)(
      ctxEnd,
      transform,
    );

    const startX = (ctxStart.arc as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const endX = (ctxEnd.arc as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(startX).toBeCloseTo(transform.toScreen(0, 0)[0], 6);
    expect(endX).toBeCloseTo(transform.toScreen(2, 2)[0], 6);
  });

  it("cure falls back to final representatives on a non-shrink step", () => {
    const ctx = fakeContext();
    cureOverlay(step("merge", { representatives: { "0": [[1, 1]] } }), points, 1)(ctx, transform);
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it("overlayFor dispatches by algorithm", () => {
    const ctx = fakeContext();
    overlayFor(
      "dbscan",
      step("visit", { point: 0, eps_circle: { center: [0, 0], radius: 0.5 }, neighbors: [] }),
      points,
      0,
    )(ctx, transform);
    expect(ctx.arc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, overlay modules not found.

- [ ] **Step 3: Implement `frontend/src/features/viz/overlays/dbscan.ts`**

```ts
import type { TraceStep } from "../../../lib/types";
import type { Overlay } from "../ScatterCanvas";

const NOOP: Overlay = () => {};

/**
 * Draws the eps-neighbourhood of the point DBSCAN is currently visiting, plus a
 * link to every neighbour inside it.
 *
 * The circle's radius is `eps * t.scale` — expressed in data units and scaled by
 * the transform — so what the user sees is literally the parameter they set.
 */
export function dbscanOverlay(step: TraceStep | null, points: number[][]): Overlay {
  if (!step) return NOOP;

  const circle = step.payload.eps_circle as { center: number[]; radius: number } | undefined;
  const neighbours = (step.payload.neighbors as number[] | undefined) ?? [];
  const queue = (step.payload.queue as number[] | undefined) ?? [];

  if (!circle) return NOOP;

  return (ctx, t) => {
    const [cx, cy] = t.toScreen(circle.center[0], circle.center[1]);

    // Points still waiting on the frontier, drawn faintly behind everything else.
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "var(--clay-accent)";
    for (const index of queue) {
      const point = points[index];
      if (!point) continue;
      const [qx, qy] = t.toScreen(point[0], point[1]);
      ctx.beginPath();
      ctx.arc(qx, qy, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "#e0b23c";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Links from the current point to everything inside its neighbourhood.
    ctx.strokeStyle = "rgba(124, 108, 240, 0.45)";
    ctx.lineWidth = 1;
    for (const index of neighbours) {
      const point = points[index];
      if (!point) continue;
      const [nx, ny] = t.toScreen(point[0], point[1]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
    }

    // The eps circle itself.
    ctx.beginPath();
    ctx.arc(cx, cy, circle.radius * t.scale, 0, Math.PI * 2);
    ctx.strokeStyle = "#7c6cf0";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#7c6cf0";
    ctx.fill();
  };
}
```

- [ ] **Step 4: Implement `frontend/src/features/viz/overlays/birch.ts`**

```ts
import type { TraceStep } from "../../../lib/types";
import type { Overlay } from "../ScatterCanvas";

const NOOP: Overlay = () => {};

interface SerialisedEntry {
  n: number;
  centroid: number[];
  radius: number;
  child: number | null;
}
interface SerialisedNode {
  id: number;
  parent: number | null;
  is_leaf: boolean;
  entries: SerialisedEntry[];
}
interface SerialisedTree {
  root: number;
  nodes: SerialisedNode[];
}

/**
 * Draws every leaf clustering feature as a circle at its centroid with its true
 * radius, so the compression BIRCH performs is visible directly on the data.
 */
export function birchOverlay(step: TraceStep | null, points: number[][]): Overlay {
  if (!step) return NOOP;

  const tree = step.payload.tree as SerialisedTree | undefined;
  const currentPoint = step.payload.point as number | undefined;
  if (!tree?.nodes) return NOOP;

  const leafEntries = tree.nodes.filter((node) => node.is_leaf).flatMap((node) => node.entries);

  return (ctx, t) => {
    for (const entry of leafEntries) {
      const [cx, cy] = t.toScreen(entry.centroid[0], entry.centroid[1] ?? 0);
      // A zero-radius entry (a single absorbed point) still needs to be visible.
      const radius = Math.max(entry.radius * t.scale, 3);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(63, 185, 154, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#3fb99a";
      ctx.fill();
    }

    if (currentPoint !== undefined && points[currentPoint]) {
      const [px, py] = t.toScreen(points[currentPoint][0], points[currentPoint][1]);
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "#e8845f";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  };
}
```

- [ ] **Step 5: Implement `frontend/src/features/viz/overlays/cure.ts`**

```ts
import type { TraceStep } from "../../../lib/types";
import type { Overlay } from "../ScatterCanvas";

const NOOP: Overlay = () => {};

/**
 * Draws a cluster's representative points, animating them along the path from
 * their scattered positions to their shrunken ones.
 *
 * `progress` runs 0 to 1 within a single shrink step, which is what makes the
 * shrink parameter legible: you watch the representatives pull inward.
 */
export function cureOverlay(
  step: TraceStep | null,
  _points: number[][],
  progress: number,
): Overlay {
  if (!step) return NOOP;

  const before = step.payload.reps_before as number[][] | undefined;
  const after = step.payload.reps_after as number[][] | undefined;
  const centroid = step.payload.centroid as number[] | undefined;

  if (!before || !after || before.length !== after.length) {
    const finals = step.payload.representatives as Record<string, number[][]> | undefined;
    if (!finals) return NOOP;
    return (ctx, t) => {
      for (const reps of Object.values(finals)) {
        for (const rep of reps) {
          const [rx, ry] = t.toScreen(rep[0], rep[1] ?? 0);
          ctx.beginPath();
          ctx.arc(rx, ry, 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#c86bd4";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    };
  }

  const eased = Math.max(0, Math.min(1, progress));

  return (ctx, t) => {
    if (centroid) {
      const [cx, cy] = t.toScreen(centroid[0], centroid[1] ?? 0);
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#e0b23c";
      ctx.fill();

      for (let i = 0; i < before.length; i += 1) {
        const x = before[i][0] + (after[i][0] - before[i][0]) * eased;
        const y = (before[i][1] ?? 0) + ((after[i][1] ?? 0) - (before[i][1] ?? 0)) * eased;
        const [rx, ry] = t.toScreen(x, y);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = "rgba(200, 107, 212, 0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (let i = 0; i < before.length; i += 1) {
      const x = before[i][0] + (after[i][0] - before[i][0]) * eased;
      const y = (before[i][1] ?? 0) + ((after[i][1] ?? 0) - (before[i][1] ?? 0)) * eased;
      const [rx, ry] = t.toScreen(x, y);

      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "#c86bd4";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  };
}
```

- [ ] **Step 6: Implement `frontend/src/features/viz/overlays/index.ts`**

```ts
import type { AlgorithmKey, TraceStep } from "../../../lib/types";
import type { Overlay } from "../ScatterCanvas";
import { birchOverlay } from "./birch";
import { cureOverlay } from "./cure";
import { dbscanOverlay } from "./dbscan";

export { birchOverlay, cureOverlay, dbscanOverlay };

/** Pick the overlay matching the algorithm being animated. */
export function overlayFor(
  algorithm: AlgorithmKey,
  step: TraceStep | null,
  points: number[][],
  progress: number,
): Overlay {
  if (algorithm === "dbscan") return dbscanOverlay(step, points);
  if (algorithm === "birch") return birchOverlay(step, points);
  return cureOverlay(step, points, progress);
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npm test` — all overlay tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/viz/overlays
git commit -m "feat: add per-algorithm canvas overlays"
```

---

## Task 18: CF-tree diagram

**Files:**
- Create: `frontend/src/features/viz/CFTreeView.tsx`, `frontend/src/features/viz/treeLayout.ts`
- Test: `frontend/src/features/viz/treeLayout.test.ts`

**Interfaces produced:**

```ts
export interface LaidOutNode { id: number; parent: number | null; is_leaf: boolean;
  entryCount: number; pointCount: number; depth: number; x: number; y: number }
export interface TreeLayout { nodes: LaidOutNode[]; width: number; height: number }
export function layoutTree(tree: SerialisedTree, nodeWidth?: number, levelHeight?: number): TreeLayout;
export function CFTreeView(props: { tree: SerialisedTree | null; highlightPath?: number[];
  splitNodes?: number[] }): JSX.Element;
```

**Design note:** a tidy-tree layout in two passes — assign each leaf the next free x slot in a depth-first walk, then set each internal node's x to the mean of its children. This keeps subtrees from overlapping without the complexity of a full Reingold-Tilford implementation, which the shallow trees BIRCH produces do not need.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/viz/treeLayout.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { layoutTree } from "./treeLayout";

const leafOnly = {
  root: 0,
  nodes: [
    { id: 0, parent: null, is_leaf: true, entries: [{ n: 5, centroid: [0, 0], radius: 0.1, child: null }] },
  ],
};

const twoLevels = {
  root: 0,
  nodes: [
    {
      id: 0,
      parent: null,
      is_leaf: false,
      entries: [
        { n: 5, centroid: [0, 0], radius: 0.3, child: 1 },
        { n: 7, centroid: [2, 2], radius: 0.4, child: 2 },
      ],
    },
    { id: 1, parent: 0, is_leaf: true, entries: [{ n: 5, centroid: [0, 0], radius: 0.3, child: null }] },
    {
      id: 2,
      parent: 0,
      is_leaf: true,
      entries: [
        { n: 4, centroid: [2, 2], radius: 0.2, child: null },
        { n: 3, centroid: [3, 3], radius: 0.2, child: null },
      ],
    },
  ],
};

describe("layoutTree", () => {
  it("lays out a single leaf at depth zero", () => {
    const layout = layoutTree(leafOnly);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].depth).toBe(0);
    expect(layout.nodes[0].entryCount).toBe(1);
    expect(layout.nodes[0].pointCount).toBe(5);
  });

  it("puts children one level below their parent", () => {
    const layout = layoutTree(twoLevels);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    expect(byId.get(0)!.depth).toBe(0);
    expect(byId.get(1)!.depth).toBe(1);
    expect(byId.get(2)!.depth).toBe(1);
    expect(byId.get(1)!.y).toBeLessThan(byId.get(2)!.y + 1);
    expect(byId.get(0)!.y).toBeLessThan(byId.get(1)!.y);
  });

  it("gives sibling leaves distinct x positions", () => {
    const layout = layoutTree(twoLevels);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    expect(byId.get(1)!.x).not.toBeCloseTo(byId.get(2)!.x, 3);
  });

  it("centres a parent over its children", () => {
    const layout = layoutTree(twoLevels);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const midpoint = (byId.get(1)!.x + byId.get(2)!.x) / 2;
    expect(byId.get(0)!.x).toBeCloseTo(midpoint, 3);
  });

  it("sums point counts per node", () => {
    const layout = layoutTree(twoLevels);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    expect(byId.get(2)!.pointCount).toBe(7);
    expect(byId.get(2)!.entryCount).toBe(2);
  });

  it("reports a bounding box that contains every node", () => {
    const layout = layoutTree(twoLevels);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(layout.width);
      expect(node.y).toBeLessThanOrEqual(layout.height);
    }
  });

  it("returns an empty layout for a null tree", () => {
    const layout = layoutTree({ root: 0, nodes: [] });
    expect(layout.nodes).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
  });

  it("does not loop forever on a tree with a missing child", () => {
    const broken = {
      root: 0,
      nodes: [
        {
          id: 0,
          parent: null,
          is_leaf: false,
          entries: [{ n: 1, centroid: [0, 0], radius: 0, child: 99 }],
        },
      ],
    };
    expect(() => layoutTree(broken)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, `./treeLayout` not found.

- [ ] **Step 3: Implement `frontend/src/features/viz/treeLayout.ts`**

```ts
export interface SerialisedEntry {
  n: number;
  centroid: number[];
  radius: number;
  child: number | null;
}
export interface SerialisedNode {
  id: number;
  parent: number | null;
  is_leaf: boolean;
  entries: SerialisedEntry[];
}
export interface SerialisedTree {
  root: number;
  nodes: SerialisedNode[];
}

export interface LaidOutNode {
  id: number;
  parent: number | null;
  is_leaf: boolean;
  entryCount: number;
  pointCount: number;
  depth: number;
  x: number;
  y: number;
}

export interface TreeLayout {
  nodes: LaidOutNode[];
  width: number;
  height: number;
}

/**
 * A two-pass tidy layout: leaves take successive x slots in a depth-first walk,
 * then each internal node centres itself over its children.
 *
 * BIRCH trees are shallow and narrow, so this is enough — a full
 * Reingold-Tilford pass would buy nothing here.
 */
export function layoutTree(
  tree: SerialisedTree,
  nodeWidth = 132,
  levelHeight = 96,
): TreeLayout {
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  if (byId.size === 0 || !byId.has(tree.root)) {
    return { nodes: [], width: nodeWidth, height: levelHeight };
  }

  const laid = new Map<number, LaidOutNode>();
  let nextLeafSlot = 0;

  // A guard set: a malformed tree must not send this into an infinite descent.
  const seen = new Set<number>();

  const walk = (id: number, depth: number): number => {
    const node = byId.get(id);
    if (!node || seen.has(id)) return nextLeafSlot * nodeWidth;
    seen.add(id);

    const childIds = node.entries
      .map((entry) => entry.child)
      .filter((child): child is number => child !== null && byId.has(child));

    let x: number;
    if (childIds.length === 0) {
      x = nextLeafSlot * nodeWidth;
      nextLeafSlot += 1;
    } else {
      const childXs = childIds.map((childId) => walk(childId, depth + 1));
      x = childXs.reduce((sum, value) => sum + value, 0) / childXs.length;
    }

    laid.set(id, {
      id: node.id,
      parent: node.parent,
      is_leaf: node.is_leaf,
      entryCount: node.entries.length,
      pointCount: node.entries.reduce((sum, entry) => sum + entry.n, 0),
      depth,
      x,
      y: depth * levelHeight,
    });
    return x;
  };

  walk(tree.root, 0);

  const nodes = [...laid.values()];
  const maxX = Math.max(nodeWidth, ...nodes.map((node) => node.x));
  const maxY = Math.max(levelHeight, ...nodes.map((node) => node.y));
  return { nodes, width: maxX + nodeWidth, height: maxY + levelHeight };
}
```

- [ ] **Step 4: Implement `frontend/src/features/viz/CFTreeView.tsx`**

```tsx
import { type SerialisedTree, layoutTree } from "./treeLayout";

const NODE_W = 96;
const NODE_H = 46;

export function CFTreeView({
  tree,
  highlightPath = [],
  splitNodes = [],
}: {
  tree: SerialisedTree | null;
  highlightPath?: number[];
  splitNodes?: number[];
}) {
  if (!tree || tree.nodes.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
        The CF-tree appears here once BIRCH has run.
      </p>
    );
  }

  const layout = layoutTree(tree);
  const onPath = new Set(highlightPath);
  const splitting = new Set(splitNodes);
  const positions = new Map(layout.nodes.map((node) => [node.id, node]));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={layout.width}
        height={layout.height}
        style={{ display: "block", minWidth: "100%" }}
      >
        {layout.nodes.map((node) => {
          const parent = node.parent === null ? null : positions.get(node.parent);
          if (!parent) return null;
          const lit = onPath.has(node.id) && onPath.has(parent.id);
          return (
            <line
              key={`edge-${node.id}`}
              x1={parent.x + NODE_W / 2}
              y1={parent.y + NODE_H}
              x2={node.x + NODE_W / 2}
              y2={node.y}
              stroke={lit ? "var(--clay-accent)" : "var(--clay-text-faint)"}
              strokeWidth={lit ? 2.5 : 1.2}
            />
          );
        })}

        {layout.nodes.map((node) => {
          const lit = onPath.has(node.id);
          const split = splitting.has(node.id);
          const fill = split
            ? "var(--clay-warn)"
            : lit
              ? "var(--clay-accent)"
              : "var(--clay-surface-raised)";
          const text = split || lit ? "#fff" : "var(--clay-text)";
          return (
            <g key={`node-${node.id}`}>
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={14}
                fill={fill}
                stroke={node.is_leaf ? "var(--clay-good)" : "var(--clay-text-faint)"}
                strokeWidth={node.is_leaf ? 2 : 1}
              />
              <text
                x={node.x + NODE_W / 2}
                y={node.y + 19}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill={text}
              >
                {node.is_leaf ? "leaf" : "internal"}
              </text>
              <text
                x={node.x + NODE_W / 2}
                y={node.y + 34}
                textAnchor="middle"
                fontSize={10}
                fill={text}
                opacity={0.85}
              >
                {node.entryCount} entries · {node.pointCount} pts
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test` — all tree layout tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/viz/treeLayout.ts frontend/src/features/viz/CFTreeView.tsx
git commit -m "feat: add CF-tree diagram with tidy layout"
```

---

## Task 19: Data panel — generators, file import, point editor

**Files:**
- Create: `frontend/src/lib/csv.ts`, `frontend/src/features/data/DataPanel.tsx`, `frontend/src/features/data/GeneratorPicker.tsx`, `frontend/src/features/data/FileImport.tsx`
- Test: `frontend/src/lib/csv.test.ts`

**Interfaces produced:**

```ts
// csv.ts
export interface SelectionResult { points: number[][]; labels: number[] | null;
  droppedRows: number; featureNames: string[] }
export function selectFeatures(table: ParsedTable, featureColumns: string[],
                               labelColumn: string | null): SelectionResult;
export function numericColumns(table: ParsedTable): string[];

// DataPanel.tsx
export function DataPanel(): JSX.Element;   // reads and writes the store directly
```

**Design note:** column selection happens entirely client-side (the backend is stateless and returned the whole table), so switching feature columns is instant. Rows with a missing value in any selected feature are dropped and counted, and the count is shown before clustering runs rather than silently swallowed.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { numericColumns, selectFeatures } from "./csv";
import type { ParsedTable } from "./types";

const table: ParsedTable = {
  columns: ["x", "y", "name", "cls"],
  dtypes: ["numeric", "numeric", "text", "numeric"],
  rows: [
    [1, 2, "a", 0],
    [3, 4, "b", 1],
    [5, null, "c", 0],
  ],
  n_rows: 3,
  suggested_features: ["x", "y"],
};

describe("selectFeatures", () => {
  it("extracts the chosen feature columns in order", () => {
    const result = selectFeatures(table, ["y", "x"], null);
    expect(result.points).toEqual([
      [2, 1],
      [4, 3],
    ]);
    expect(result.featureNames).toEqual(["y", "x"]);
  });

  it("drops rows with a missing value and reports the count", () => {
    const result = selectFeatures(table, ["x", "y"], null);
    expect(result.points).toHaveLength(2);
    expect(result.droppedRows).toBe(1);
  });

  it("keeps a row whose missing value is in an unselected column", () => {
    const result = selectFeatures(table, ["x"], null);
    expect(result.points).toHaveLength(3);
    expect(result.droppedRows).toBe(0);
  });

  it("extracts a label column alongside the features", () => {
    const result = selectFeatures(table, ["x", "y"], "cls");
    expect(result.labels).toEqual([0, 1]);
  });

  it("returns null labels when no label column is chosen", () => {
    expect(selectFeatures(table, ["x", "y"], null).labels).toBeNull();
  });

  it("maps non-numeric label values to distinct integers", () => {
    const result = selectFeatures(table, ["x"], "name");
    expect(result.labels).toEqual([0, 1, 2]);
  });

  it("throws when no feature column is selected", () => {
    expect(() => selectFeatures(table, [], null)).toThrow();
  });

  it("throws when a selected column does not exist", () => {
    expect(() => selectFeatures(table, ["nope"], null)).toThrow();
  });

  it("throws when a selected feature column is not numeric", () => {
    expect(() => selectFeatures(table, ["name"], null)).toThrow(/numeric/i);
  });

  it("throws when every row would be dropped", () => {
    const allMissing: ParsedTable = {
      columns: ["x"],
      dtypes: ["numeric"],
      rows: [[null], [null]],
      n_rows: 2,
      suggested_features: ["x"],
    };
    expect(() => selectFeatures(allMissing, ["x"], null)).toThrow();
  });
});

describe("numericColumns", () => {
  it("lists only numeric columns", () => {
    expect(numericColumns(table)).toEqual(["x", "y", "cls"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, `./csv` not found.

- [ ] **Step 3: Implement `frontend/src/lib/csv.ts`**

```ts
import type { ParsedTable } from "./types";

export interface SelectionResult {
  points: number[][];
  labels: number[] | null;
  droppedRows: number;
  featureNames: string[];
}

/** The names of every column the backend inferred as numeric. */
export function numericColumns(table: ParsedTable): string[] {
  return table.columns.filter((_, index) => table.dtypes[index] === "numeric");
}

/**
 * Project a parsed table onto the chosen feature columns.
 *
 * Rows missing a value in any selected feature are dropped and counted, so the
 * UI can tell the user how much data it discarded instead of hiding it.
 */
export function selectFeatures(
  table: ParsedTable,
  featureColumns: string[],
  labelColumn: string | null,
): SelectionResult {
  if (featureColumns.length === 0) {
    throw new Error("Select at least one feature column.");
  }

  const indices = featureColumns.map((name) => {
    const index = table.columns.indexOf(name);
    if (index === -1) throw new Error(`There is no column named "${name}".`);
    if (table.dtypes[index] !== "numeric") {
      throw new Error(`Column "${name}" is not numeric, so it cannot be a feature.`);
    }
    return index;
  });

  const labelIndex = labelColumn === null ? -1 : table.columns.indexOf(labelColumn);
  if (labelColumn !== null && labelIndex === -1) {
    throw new Error(`There is no column named "${labelColumn}".`);
  }

  const points: number[][] = [];
  const rawLabels: (number | string)[] = [];
  let droppedRows = 0;

  for (const row of table.rows) {
    const values = indices.map((index) => row[index]);
    if (values.some((value) => value === null || typeof value !== "number" || !Number.isFinite(value))) {
      droppedRows += 1;
      continue;
    }
    points.push(values as number[]);
    if (labelIndex !== -1) {
      const value = row[labelIndex];
      rawLabels.push(value === null ? "" : (value as number | string));
    }
  }

  if (points.length === 0) {
    throw new Error("Every row was dropped — the selected columns have no usable numbers.");
  }

  let labels: number[] | null = null;
  if (labelIndex !== -1) {
    // Non-numeric labels become stable integers by first appearance.
    const seen = new Map<string, number>();
    labels = rawLabels.map((value) => {
      const key = String(value);
      if (!seen.has(key)) seen.set(key, seen.size);
      return seen.get(key)!;
    });
  }

  return { points, labels, droppedRows, featureNames: featureColumns };
}
```

- [ ] **Step 4: Implement `frontend/src/features/data/GeneratorPicker.tsx`**

```tsx
import { useEffect, useState } from "react";

import { ClayButton, ClaySelect, ClaySlider } from "../../clay";
import { api } from "../../lib/api";
import type { GeneratorSpec } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

export function GeneratorPicker() {
  const [generators, setGenerators] = useState<Record<string, GeneratorSpec>>({});
  const [kind, setKind] = useState("blobs");
  const [count, setCount] = useState(300);
  const [noise, setNoise] = useState(0.05);
  const [seed, setSeed] = useState(42);

  const { setPoints, setError, setBusy } = useAppStore();

  useEffect(() => {
    api.generators().then(setGenerators).catch(() => setGenerators({}));
  }, []);

  const active = generators[kind];

  async function build() {
    setBusy(true);
    try {
      const data = await api.generate({
        kind,
        n_samples: count,
        noise,
        random_seed: seed,
      });
      setPoints(data.points, data.feature_names, data.source_labels, active?.label ?? kind);
      setError(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ClaySelect
        label="Dataset"
        value={kind}
        onChange={setKind}
        options={Object.values(generators).map((generator) => ({
          value: generator.key,
          label: generator.label,
        }))}
      />
      {active && (
        <p className="text-[11px] mb-4 leading-snug" style={{ color: "var(--clay-text-muted)" }}>
          {active.hint}
        </p>
      )}
      <ClaySlider label="Points" value={count} min={20} max={2000} step={10} onChange={setCount} />
      <ClaySlider
        label="Noise"
        value={noise}
        min={0}
        max={0.5}
        step={0.01}
        onChange={setNoise}
        disabled={active ? !active.supports_noise : false}
      />
      <ClaySlider label="Seed" value={seed} min={0} max={999} step={1} onChange={setSeed} />
      <ClayButton variant="primary" onClick={build}>
        Generate
      </ClayButton>
    </div>
  );
}
```

- [ ] **Step 5: Implement `frontend/src/features/data/FileImport.tsx`**

```tsx
import { useRef, useState } from "react";

import { ClayBadge, ClayButton } from "../../clay";
import { api } from "../../lib/api";
import { numericColumns, selectFeatures } from "../../lib/csv";
import type { ParsedTable } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

export function FileImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [labelColumn, setLabelColumn] = useState<string | null>(null);
  const [dropped, setDropped] = useState<number | null>(null);
  const [name, setName] = useState("");

  const { setPoints, setError, setBusy } = useAppStore();

  async function onFile(file: File) {
    setBusy(true);
    try {
      const parsed = await api.upload(file);
      setTable(parsed);
      setFeatures(parsed.suggested_features);
      setLabelColumn(null);
      setDropped(null);
      setName(file.name);
      setError(null);
    } catch (error) {
      setError((error as Error).message);
      setTable(null);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!table) return;
    try {
      const result = selectFeatures(table, features, labelColumn);
      setPoints(result.points, result.featureNames, result.labels, name);
      setDropped(result.droppedRows);
      setError(null);
    } catch (error) {
      setError((error as Error).message);
    }
  }

  function toggleFeature(column: string) {
    setFeatures((current) =>
      current.includes(column) ? current.filter((c) => c !== column) : [...current, column],
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <ClayButton variant="primary" onClick={() => inputRef.current?.click()}>
        Choose a CSV or JSON file
      </ClayButton>

      {table && (
        <div className="mt-4">
          <p className="text-xs mb-2" style={{ color: "var(--clay-text-muted)" }}>
            {table.n_rows} rows · pick the feature columns (order matters)
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {numericColumns(table).map((column) => (
              <ClayButton
                key={column}
                size="sm"
                active={features.includes(column)}
                variant={features.includes(column) ? "primary" : "ghost"}
                onClick={() => toggleFeature(column)}
              >
                {column}
                {features.includes(column) ? ` (${features.indexOf(column) + 1})` : ""}
              </ClayButton>
            ))}
          </div>

          <p className="text-xs mb-2" style={{ color: "var(--clay-text-muted)" }}>
            Ground-truth label column (optional, never fed to the algorithms)
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <ClayButton
              size="sm"
              active={labelColumn === null}
              onClick={() => setLabelColumn(null)}
            >
              none
            </ClayButton>
            {table.columns.map((column) => (
              <ClayButton
                key={column}
                size="sm"
                active={labelColumn === column}
                onClick={() => setLabelColumn(column)}
              >
                {column}
              </ClayButton>
            ))}
          </div>

          <ClayButton variant="primary" onClick={apply} disabled={features.length === 0}>
            Use these columns
          </ClayButton>

          {dropped !== null && dropped > 0 && (
            <p className="mt-3">
              <ClayBadge tone="warn">
                {dropped} row{dropped === 1 ? "" : "s"} dropped for missing values
              </ClayBadge>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Implement `frontend/src/features/data/DataPanel.tsx`**

```tsx
import { useState } from "react";

import { ClayBadge, ClayButton, ClayCard, ClayTabs } from "../../clay";
import { useAppStore } from "../../store/appStore";
import { FileImport } from "./FileImport";
import { GeneratorPicker } from "./GeneratorPicker";

const TABS = [
  { id: "generate", label: "Generate" },
  { id: "import", label: "Import" },
  { id: "draw", label: "Draw" },
];

export function DataPanel() {
  const [tab, setTab] = useState("generate");
  const { points, featureNames, datasetName, clearPoints } = useAppStore();

  return (
    <ClayCard title="Data" subtitle={`${points.length} points · ${featureNames.length}D · ${datasetName}`}>
      <div className="mb-4">
        <ClayTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === "generate" && <GeneratorPicker />}
      {tab === "import" && <FileImport />}
      {tab === "draw" && (
        <div>
          {featureNames.length === 2 ? (
            <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--clay-text-muted)" }}>
              Click the empty canvas to add a point, drag a point to move it, and
              right-click (or alt-click) a point to delete it.
            </p>
          ) : (
            <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--clay-warn)" }}>
              Drawing is only available for 2D data. This dataset has{" "}
              {featureNames.length} features, and the canvas shows a PCA
              projection — a click there has no single meaning in the original space.
            </p>
          )}
          <ClayButton variant="danger" onClick={clearPoints} disabled={points.length === 0}>
            Clear all points
          </ClayButton>
        </div>
      )}

      {featureNames.length > 2 && (
        <p className="mt-4">
          <ClayBadge tone="accent">clustered in {featureNames.length}D · shown via PCA</ClayBadge>
        </p>
      )}
    </ClayCard>
  );
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npm test` — all csv tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/csv.ts frontend/src/features/data
git commit -m "feat: add data panel with generators, import, and drawing"
```

---

## Task 20: Schema-driven parameter panel

**Files:**
- Create: `frontend/src/features/params/ParamPanel.tsx`
- Test: `frontend/src/features/params/ParamPanel.test.tsx`

**Interfaces produced:** `ParamPanel({ algorithm }: { algorithm: AlgorithmKey }): JSX.Element`

**Design note:** every control is generated from the backend's `params` array, so the UI can never offer a knob the backend rejects. An optional int parameter whose default is `null` (BIRCH's `n_clusters`, CURE's `sample_size`) renders as a toggle plus a slider — off sends nothing, which is what the backend's `_clean_params` expects.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/params/ParamPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { AlgorithmSpec } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { ParamPanel } from "./ParamPanel";

const specs = {
  dbscan: {
    key: "dbscan",
    label: "DBSCAN",
    tagline: "",
    params: [
      { name: "eps", label: "eps", type: "float", default: 0.5, min: 0.01, max: 5, step: 0.01, help: "radius" },
      { name: "min_pts", label: "minPts", type: "int", default: 5, min: 1, max: 50, step: 1, help: "count" },
      {
        name: "metric",
        label: "Metric",
        type: "choice",
        default: "euclidean",
        options: ["euclidean", "manhattan"],
        help: "distance",
      },
    ],
    theory: { summary: "", how_it_works: [], parameters: {}, complexity: "", strengths: [], weaknesses: [] },
  },
  birch: {
    key: "birch",
    label: "BIRCH",
    tagline: "",
    params: [
      {
        name: "n_clusters",
        label: "clusters",
        type: "int",
        default: null,
        min: 1,
        max: 20,
        step: 1,
        help: "optional",
      },
    ],
    theory: { summary: "", how_it_works: [], parameters: {}, complexity: "", strengths: [], weaknesses: [] },
  },
  cure: {
    key: "cure",
    label: "CURE",
    tagline: "",
    params: [],
    theory: { summary: "", how_it_works: [], parameters: {}, complexity: "", strengths: [], weaknesses: [] },
  },
} as unknown as Record<"dbscan" | "birch" | "cure", AlgorithmSpec>;

beforeEach(() => {
  useAppStore.getState().setSpecs(specs);
});

describe("ParamPanel", () => {
  it("renders a control for every declared parameter", () => {
    render(<ParamPanel algorithm="dbscan" />);
    expect(screen.getByLabelText("eps")).toBeDefined();
    expect(screen.getByLabelText("minPts")).toBeDefined();
    expect(screen.getByLabelText("Metric")).toBeDefined();
  });

  it("seeds controls from the declared defaults", () => {
    render(<ParamPanel algorithm="dbscan" />);
    expect((screen.getByLabelText("eps") as HTMLInputElement).value).toBe("0.5");
  });

  it("writes slider changes into the store", () => {
    render(<ParamPanel algorithm="dbscan" />);
    fireEvent.change(screen.getByLabelText("eps"), { target: { value: "1.25" } });
    expect(useAppStore.getState().params.dbscan.eps).toBe(1.25);
  });

  it("writes choice changes into the store", () => {
    render(<ParamPanel algorithm="dbscan" />);
    fireEvent.change(screen.getByLabelText("Metric"), { target: { value: "manhattan" } });
    expect(useAppStore.getState().params.dbscan.metric).toBe("manhattan");
  });

  it("renders an optional parameter as an off toggle", () => {
    render(<ParamPanel algorithm="birch" />);
    const toggle = screen.getByLabelText("Set clusters") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(screen.queryByLabelText("clusters")).toBeNull();
  });

  it("enabling an optional parameter sets it to its minimum-backed default", () => {
    render(<ParamPanel algorithm="birch" />);
    fireEvent.click(screen.getByLabelText("Set clusters"));
    expect(useAppStore.getState().params.birch.n_clusters).not.toBeNull();
    expect(screen.getByLabelText("clusters")).toBeDefined();
  });

  it("disabling an optional parameter clears it back to null", () => {
    render(<ParamPanel algorithm="birch" />);
    fireEvent.click(screen.getByLabelText("Set clusters"));
    fireEvent.click(screen.getByLabelText("Set clusters"));
    expect(useAppStore.getState().params.birch.n_clusters).toBeNull();
  });

  it("renders nothing but a note when the algorithm has no parameters", () => {
    render(<ParamPanel algorithm="cure" />);
    expect(screen.getByText(/no parameters/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, `./ParamPanel` not found.

- [ ] **Step 3: Implement `frontend/src/features/params/ParamPanel.tsx`**

```tsx
import { ClaySelect, ClaySlider, ClayToggle } from "../../clay";
import type { AlgorithmKey, ParamSpec } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

/** Optional numeric parameters declare a null default and may be left unset. */
function isOptional(spec: ParamSpec): boolean {
  return spec.default === null && (spec.type === "int" || spec.type === "float");
}

export function ParamPanel({ algorithm }: { algorithm: AlgorithmKey }) {
  const specs = useAppStore((state) => state.specs);
  const params = useAppStore((state) => state.params[algorithm]);
  const setParam = useAppStore((state) => state.setParam);

  const spec = specs?.[algorithm];
  if (!spec) {
    return (
      <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
        Loading parameters…
      </p>
    );
  }
  if (spec.params.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
        This algorithm has no parameters.
      </p>
    );
  }

  return (
    <div>
      {spec.params.map((param) => {
        const value = params?.[param.name] ?? param.default;

        if (param.type === "choice") {
          return (
            <ClaySelect
              key={param.name}
              label={param.label}
              help={param.help}
              value={String(value ?? param.options?.[0] ?? "")}
              options={(param.options ?? []).map((option) => ({ value: option, label: option }))}
              onChange={(next) => setParam(algorithm, param.name, next)}
            />
          );
        }

        if (isOptional(param)) {
          const enabled = value !== null && value !== undefined;
          return (
            <div key={param.name}>
              <ClayToggle
                label={`Set ${param.label}`}
                help={param.help}
                checked={enabled}
                onChange={(on) =>
                  setParam(algorithm, param.name, on ? (param.min ?? 1) + 2 : null)
                }
              />
              {enabled && (
                <ClaySlider
                  label={param.label}
                  help={param.help}
                  value={Number(value)}
                  min={param.min ?? 0}
                  max={param.max ?? 100}
                  step={param.step ?? 1}
                  onChange={(next) => setParam(algorithm, param.name, next)}
                />
              )}
            </div>
          );
        }

        return (
          <ClaySlider
            key={param.name}
            label={param.label}
            help={param.help}
            value={Number(value ?? 0)}
            min={param.min ?? 0}
            max={param.max ?? 100}
            step={param.step ?? 1}
            onChange={(next) => setParam(algorithm, param.name, next)}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` — all ParamPanel tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/params
git commit -m "feat: add schema-driven parameter panel"
```

---

## Task 21: Metrics panel and narration log

**Files:**
- Create: `frontend/src/features/metrics/MetricsPanel.tsx`, `frontend/src/features/metrics/NarrationLog.tsx`, `frontend/src/lib/format.ts`
- Test: `frontend/src/lib/format.test.ts`

**Interfaces produced:**

```ts
// format.ts
export function formatMetric(value: number | null, digits?: number): string;   // null -> "—"
export function formatMs(ms: number): string;                                  // "41 ms" / "1.2 s"
export function formatPercent(value: number): string;

// components
export function MetricsPanel(props: { result: ClusterResponse | null }): JSX.Element;
export function NarrationLog(props: { steps: TraceStep[]; playhead: number }): JSX.Element;
```

**Design note:** a `null` metric renders as an em dash with a tooltip explaining why it is undefined (fewer than two clusters, or a singleton cluster), never as `0` or `NaN`. Showing a number where the mathematics has none would quietly mislead — which matters more here than usual, because this is a teaching tool.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatMetric, formatMs, formatParams, formatPercent } from "./format";

describe("formatMetric", () => {
  it("renders an em dash for null", () => {
    expect(formatMetric(null)).toBe("—");
  });

  it("rounds to three digits by default", () => {
    expect(formatMetric(0.612345)).toBe("0.612");
  });

  it("respects a custom digit count", () => {
    expect(formatMetric(0.612345, 1)).toBe("0.6");
  });

  it("keeps the sign on negative scores", () => {
    expect(formatMetric(-0.25)).toBe("-0.250");
  });

  it("renders an em dash for NaN", () => {
    expect(formatMetric(Number.NaN)).toBe("—");
  });
});

describe("formatMs", () => {
  it("uses milliseconds below a second", () => {
    expect(formatMs(41.2)).toBe("41 ms");
  });

  it("switches to seconds at and above 1000ms", () => {
    expect(formatMs(1250)).toBe("1.25 s");
  });

  it("handles zero", () => {
    expect(formatMs(0)).toBe("0 ms");
  });
});

describe("formatPercent", () => {
  it("renders a fraction as a percentage", () => {
    expect(formatPercent(0.723)).toBe("72%");
  });
});

describe("formatParams", () => {
  it("renders DBSCAN parameters with their conventional symbols", () => {
    expect(formatParams({ eps: 0.5, min_pts: 5 })).toBe("ε = 0.5  ·  minPts = 5");
  });

  it("renders BIRCH parameters", () => {
    expect(formatParams({ threshold: 0.5, branching_factor: 50, n_clusters: 3 })).toBe(
      "T = 0.5  ·  B = 50  ·  k = 3",
    );
  });

  it("renders CURE parameters", () => {
    expect(formatParams({ n_clusters: 3, n_representatives: 5, shrink_factor: 0.2 })).toBe(
      "k = 3  ·  c = 5  ·  α = 0.2",
    );
  });

  it("omits parameters that were left unset", () => {
    expect(formatParams({ threshold: 0.5, n_clusters: null })).toBe("T = 0.5");
  });

  it("keeps string parameters as-is", () => {
    expect(formatParams({ metric: "manhattan" })).toBe("metric = manhattan");
  });

  it("falls back to the raw key for an unknown parameter", () => {
    expect(formatParams({ mystery: 7 })).toBe("mystery = 7");
  });

  it("renders an empty string for no parameters", () => {
    expect(formatParams({})).toBe("");
  });

  it("trims trailing zeros rather than padding", () => {
    expect(formatParams({ eps: 0.3 })).toBe("ε = 0.3");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, `./format` not found.

- [ ] **Step 3: Implement `frontend/src/lib/format.ts`**

```ts
/** A metric with no defined value renders as an em dash, never as 0 or NaN. */
export function formatMetric(value: number | null, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Display names for algorithm parameters, using the symbols the literature and
 * most course notes use, so what the UI shows matches what a marker expects.
 */
const PARAM_LABELS: Record<string, string> = {
  eps: "ε",
  min_pts: "minPts",
  metric: "metric",
  threshold: "T",
  branching_factor: "B",
  n_clusters: "k",
  n_representatives: "c",
  shrink_factor: "α",
  sample_size: "sample",
  random_seed: "seed",
};

/**
 * The parameters a result was actually produced with, as a single readable line.
 *
 * This reads from `params_used` on the response — the values the backend really
 * ran with — not from the slider state, which the user may have moved since.
 */
export function formatParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      const label = PARAM_LABELS[key] ?? key;
      const shown = typeof value === "number" ? Number(value.toFixed(4)) : String(value);
      return `${label} = ${shown}`;
    })
    .join("  ·  ");
}
```

- [ ] **Step 4: Implement `frontend/src/features/metrics/MetricsPanel.tsx`**

```tsx
import { ClayBadge, ClayCard } from "../../clay";
import { clusterColor } from "../../lib/colors";
import { formatMetric, formatMs, formatPercent } from "../../lib/format";
import type { ClusterResponse } from "../../lib/types";

const UNDEFINED_REASON =
  "Undefined for this result: the score needs at least two clusters, each with at least two members.";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
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
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--clay-text-faint)" }}>
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
    <ClayCard title="Quality" subtitle={`${result.algorithm.toUpperCase()} · ${formatMs(result.runtime_ms)}`}>
      {/* The parameters this result was actually produced with — read from
          params_used, not from the sliders, which the user may have since moved. */}
      <div
        className="px-3 py-2 mb-4"
        style={{
          background: "var(--clay-accent-soft)",
          borderRadius: "var(--clay-radius-sm)",
        }}
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
          value={total > 0 ? `${formatPercent(metrics.n_noise / total)}` : "—"}
          hint={`${metrics.n_noise} of ${total} points left unassigned`}
        />
        <Stat
          label="Silhouette"
          value={formatMetric(metrics.silhouette)}
          hint={metrics.silhouette === null ? UNDEFINED_REASON : "Higher is better; ranges -1 to 1."}
        />
        <Stat
          label="Davies-Bouldin"
          value={formatMetric(metrics.davies_bouldin)}
          hint={metrics.davies_bouldin === null ? UNDEFINED_REASON : "Lower is better; 0 is ideal."}
        />
      </div>

      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--clay-text-faint)" }}>
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
        {metrics.n_noise > 0 && (
          <ClayBadge tone="neutral">{metrics.n_noise} noise</ClayBadge>
        )}
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
```

- [ ] **Step 5: Implement `frontend/src/features/metrics/NarrationLog.tsx`**

```tsx
import { ClayCard } from "../../clay";
import { narrationLog } from "../../lib/trace";
import type { TraceStep } from "../../lib/types";

export function NarrationLog({ steps, playhead }: { steps: TraceStep[]; playhead: number }) {
  const lines = narrationLog(steps, playhead, 7);

  return (
    <ClayCard title="What it is doing" tone="raised">
      {lines.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
          Press play to watch the algorithm narrate itself, step by step.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {lines.map((line, index) => {
            const isCurrent = index === lines.length - 1;
            return (
              <li
                key={`${playhead}-${index}`}
                className="text-xs leading-relaxed px-3 py-2"
                style={{
                  background: isCurrent ? "var(--clay-accent-soft)" : "transparent",
                  color: isCurrent ? "var(--clay-text)" : "var(--clay-text-muted)",
                  borderRadius: "var(--clay-radius-sm)",
                  fontWeight: isCurrent ? 700 : 400,
                  opacity: isCurrent ? 1 : 0.55 + index * 0.06,
                  transition: "opacity var(--clay-fast) ease",
                }}
              >
                {line}
              </li>
            );
          })}
        </ol>
      )}
    </ClayCard>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test` — all format tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/format.ts frontend/src/features/metrics
git commit -m "feat: add metrics panel and narration log"
```

---

## Task 22: Compare mode

**Files:**
- Create: `frontend/src/features/compare/CompareGrid.tsx`
- Test: none beyond the shared api test — this component composes already-tested pieces and its logic is a single fetch.

**Interfaces produced:** `CompareGrid(): JSX.Element`

**Design note:** all three panels share one transform because they render the same point set, so a cluster in one panel sits at the same pixel as the same point in the others — that is what makes the comparison readable. Compare mode never animates; the backend returns empty traces for it, which keeps the payload small.

- [ ] **Step 1: Implement `frontend/src/features/compare/CompareGrid.tsx`**

```tsx
import { useState } from "react";

import { ClayBadge, ClayButton, ClayCard } from "../../clay";
import { api } from "../../lib/api";
import { formatMetric, formatMs } from "../../lib/format";
import type { AlgorithmKey, ClusterResponse } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { ScatterCanvas } from "../viz/ScatterCanvas";

const ORDER: AlgorithmKey[] = ["dbscan", "birch", "cure"];

export function CompareGrid() {
  const { points, params, standardize, compareResults, setCompareResults, setError } = useAppStore();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (points.length === 0) {
      setError("Load or generate some data first.");
      return;
    }
    setBusy(true);
    try {
      const results = await api.compare({
        points,
        configs: {
          dbscan: params.dbscan,
          birch: params.birch,
          cure: params.cure,
        },
        standardize,
      });
      setCompareResults(results);
      setError(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <ClayButton variant="primary" onClick={run} disabled={busy || points.length === 0}>
          {busy ? "Running all three…" : "Run all three"}
        </ClayButton>
        <span className="text-xs" style={{ color: "var(--clay-text-muted)" }}>
          Same data, same parameters as the single-algorithm tabs. No animation here —
          this view is for comparing outcomes.
        </span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {ORDER.map((key) => {
          const result: ClusterResponse | undefined = compareResults?.[key];
          return (
            <ClayCard key={key} title={key.toUpperCase()} tone="raised">
              {result ? (
                <>
                  <ScatterCanvas
                    points={result.projection.points_2d}
                    labels={result.labels}
                    pointTypes={result.extras.point_types as string[] | undefined}
                    height={260}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <ClayBadge tone="accent">{result.n_clusters} clusters</ClayBadge>
                    {result.n_noise > 0 && <ClayBadge>{result.n_noise} noise</ClayBadge>}
                    <ClayBadge>sil {formatMetric(result.metrics.silhouette, 2)}</ClayBadge>
                    <ClayBadge>db {formatMetric(result.metrics.davies_bouldin, 2)}</ClayBadge>
                    <ClayBadge>{formatMs(result.runtime_ms)}</ClayBadge>
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
                  Not run yet.
                </p>
              )}
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build` from `frontend/`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/compare
git commit -m "feat: add side-by-side comparison grid"
```

---

## Task 23: Exports

**Files:**
- Create: `frontend/src/lib/export.ts`, `frontend/src/features/export/ExportBar.tsx`
- Test: `frontend/src/lib/export.test.ts`

**Interfaces produced:**

```ts
export function toLabelledCsv(points: number[][], featureNames: string[],
                              labels: number[]): string;
export function toRunReport(result: ClusterResponse, datasetName: string,
                            pointCount: number): string;   // pretty-printed JSON
export function downloadText(filename: string, text: string, mime?: string): void;
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void;
export function ExportBar(props: { result: ClusterResponse | null }): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/export.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { toLabelledCsv, toRunReport } from "./export";
import type { ClusterResponse } from "./types";

describe("toLabelledCsv", () => {
  it("writes a header from the feature names plus cluster and noise", () => {
    const csv = toLabelledCsv([[1, 2]], ["x", "y"], [0]);
    expect(csv.split("\n")[0]).toBe("x,y,cluster,is_noise");
  });

  it("writes one row per point", () => {
    const csv = toLabelledCsv(
      [
        [1, 2],
        [3, 4],
      ],
      ["x", "y"],
      [0, 1],
    );
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("1,2,0,false");
  });

  it("marks noise points", () => {
    const csv = toLabelledCsv([[1, 2]], ["x", "y"], [-1]);
    expect(csv.trim().split("\n")[1]).toBe("1,2,-1,true");
  });

  it("quotes feature names containing a comma", () => {
    const csv = toLabelledCsv([[1]], ["a,b"], [0]);
    expect(csv.split("\n")[0]).toBe('"a,b",cluster,is_noise');
  });

  it("handles an empty point set by emitting only a header", () => {
    expect(toLabelledCsv([], ["x"], []).trim()).toBe("x,cluster,is_noise");
  });

  it("falls back to -1 when a label is missing", () => {
    const csv = toLabelledCsv([[1]], ["x"], []);
    expect(csv.trim().split("\n")[1]).toBe("1,-1,true");
  });
});

describe("toRunReport", () => {
  const result = {
    algorithm: "dbscan",
    labels: [0, 0, -1],
    n_clusters: 1,
    n_noise: 1,
    params_used: { eps: 0.5, min_pts: 5 },
    runtime_ms: 12.5,
    metrics: {
      silhouette: 0.6,
      davies_bouldin: 0.7,
      n_clusters: 1,
      n_noise: 1,
      cluster_sizes: { "0": 2 },
    },
    projection: { points_2d: [], explained_variance_ratio: null },
    extras: {},
    trace: { steps: [], truncated: false, sample_rate: 1 },
  } as unknown as ClusterResponse;

  it("records the algorithm, parameters, and metrics", () => {
    const report = JSON.parse(toRunReport(result, "blobs", 3));
    expect(report.algorithm).toBe("dbscan");
    expect(report.parameters).toEqual({ eps: 0.5, min_pts: 5 });
    expect(report.metrics.silhouette).toBe(0.6);
    expect(report.dataset.name).toBe("blobs");
    expect(report.dataset.n_points).toBe(3);
  });

  it("omits the trace, which is far too large for a report", () => {
    const report = JSON.parse(toRunReport(result, "blobs", 3));
    expect(report.trace).toBeUndefined();
  });

  it("includes a timestamp", () => {
    const report = JSON.parse(toRunReport(result, "blobs", 3));
    expect(typeof report.generated_at).toBe("string");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — FAIL, `./export` not found.

- [ ] **Step 3: Implement `frontend/src/lib/export.ts`**

```ts
import type { ClusterResponse } from "./types";

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The original features plus the assigned cluster and an explicit noise flag. */
export function toLabelledCsv(
  points: number[][],
  featureNames: string[],
  labels: number[],
): string {
  const header = [...featureNames.map(csvCell), "cluster", "is_noise"].join(",");
  const rows = points.map((point, index) => {
    const label = labels[index] ?? -1;
    return [...point.map(csvCell), label, label < 0].join(",");
  });
  return [header, ...rows].join("\n") + "\n";
}

/** A compact JSON summary of one run, small enough to paste into a writeup. */
export function toRunReport(
  result: ClusterResponse,
  datasetName: string,
  pointCount: number,
): string {
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      dataset: { name: datasetName, n_points: pointCount },
      algorithm: result.algorithm,
      parameters: result.params_used,
      runtime_ms: result.runtime_ms,
      n_clusters: result.n_clusters,
      n_noise: result.n_noise,
      metrics: result.metrics,
      projection_explained_variance: result.projection.explained_variance_ratio,
    },
    null,
    2,
  );
}

export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Re-renders the canvas at 2x so the exported image is presentation-quality. */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
```

- [ ] **Step 4: Implement `frontend/src/features/export/ExportBar.tsx`**

```tsx
import { ClayButton } from "../../clay";
import { downloadCanvasPng, downloadText, toLabelledCsv, toRunReport } from "../../lib/export";
import type { ClusterResponse } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

export function ExportBar({ result }: { result: ClusterResponse | null }) {
  const { points, featureNames, datasetName } = useAppStore();
  const disabled = result === null;

  return (
    <div className="flex flex-wrap gap-2">
      <ClayButton
        size="sm"
        disabled={disabled}
        onClick={() =>
          result &&
          downloadText(
            `${datasetName}-${result.algorithm}-labels.csv`,
            toLabelledCsv(points, featureNames, result.labels),
            "text/csv",
          )
        }
      >
        Export CSV
      </ClayButton>

      <ClayButton
        size="sm"
        disabled={disabled}
        onClick={() => {
          const canvas = document.querySelector("canvas");
          if (canvas && result) {
            downloadCanvasPng(canvas, `${datasetName}-${result.algorithm}.png`);
          }
        }}
      >
        Export PNG
      </ClayButton>

      <ClayButton
        size="sm"
        disabled={disabled}
        onClick={() =>
          result &&
          downloadText(
            `${datasetName}-${result.algorithm}-report.json`,
            toRunReport(result, datasetName, points.length),
            "application/json",
          )
        }
      >
        Export report
      </ClayButton>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test` — all export tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/export.ts frontend/src/features/export
git commit -m "feat: add CSV, PNG, and report exports"
```

---

## Task 24: Theory panel

**Files:**
- Create: `frontend/src/features/theory/TheoryPanel.tsx`

**Interfaces produced:** `TheoryPanel({ algorithm }: { algorithm: AlgorithmKey }): JSX.Element`

**Design note:** every word here comes from `/api/algorithms`, the same source that builds the parameter controls. Nothing is hardcoded in the component, so the help text beside a slider and the explanation on this page cannot disagree.

- [ ] **Step 1: Implement `frontend/src/features/theory/TheoryPanel.tsx`**

```tsx
import { ClayCard } from "../../clay";
import type { AlgorithmKey } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3
        className="text-[10px] font-bold uppercase tracking-wider mb-2"
        style={{ color: "var(--clay-text-faint)" }}
      >
        {heading}
      </h3>
      {children}
    </div>
  );
}

export function TheoryPanel({ algorithm }: { algorithm: AlgorithmKey }) {
  const spec = useAppStore((state) => state.specs?.[algorithm]);

  if (!spec) {
    return (
      <ClayCard title="Theory">
        <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
          Loading…
        </p>
      </ClayCard>
    );
  }

  const { theory } = spec;

  return (
    <ClayCard title={spec.label} subtitle={spec.tagline}>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--clay-text)" }}>
        {theory.summary}
      </p>

      <Section heading="How it works">
        <ol className="flex flex-col gap-2">
          {theory.how_it_works.map((line, index) => (
            <li key={index} className="flex gap-2.5 text-xs leading-relaxed">
              <span
                className="shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: "var(--clay-accent-soft)",
                  color: "var(--clay-accent)",
                  borderRadius: "999px",
                }}
              >
                {index + 1}
              </span>
              <span style={{ color: "var(--clay-text-muted)" }}>{line}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section heading="Parameters">
        <dl className="flex flex-col gap-2.5">
          {spec.params.map((param) => (
            <div key={param.name}>
              <dt className="text-xs font-bold font-mono" style={{ color: "var(--clay-accent)" }}>
                {param.name}
              </dt>
              <dd className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--clay-text-muted)" }}>
                {theory.parameters[param.name] ?? param.help}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section heading="Complexity">
        <p className="text-xs leading-relaxed" style={{ color: "var(--clay-text-muted)" }}>
          {theory.complexity}
        </p>
      </Section>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Section heading="Strengths">
          <ul className="flex flex-col gap-1.5">
            {theory.strengths.map((line, index) => (
              <li key={index} className="text-xs leading-relaxed" style={{ color: "var(--clay-text-muted)" }}>
                <span style={{ color: "var(--clay-good)" }}>+ </span>
                {line}
              </li>
            ))}
          </ul>
        </Section>
        <Section heading="Weaknesses">
          <ul className="flex flex-col gap-1.5">
            {theory.weaknesses.map((line, index) => (
              <li key={index} className="text-xs leading-relaxed" style={{ color: "var(--clay-text-muted)" }}>
                <span style={{ color: "var(--clay-warn)" }}>− </span>
                {line}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </ClayCard>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/theory
git commit -m "feat: add algorithm theory panels"
```

---

## Task 25: Application shell, wiring, and README

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/main.tsx`
- Create: `README.md`
- Test: manual verification checklist below

**Interfaces consumed:** every component built in tasks 13–24.

**Design note:** the shell owns the run loop. A debounced effect re-clusters whenever the points, parameters, or scaling change while auto-run is on, and the backend health check runs on mount and every 10 seconds so a dropped backend shows as an explicit banner rather than as silently stale results.

- [ ] **Step 1: Implement `frontend/src/App.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";

import { ClayBadge, ClayButton, ClayCard, ClayTabs, ClayToggle } from "./clay";
import { api } from "./lib/api";
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

  // Load the algorithm registry once, and keep an eye on the backend.
  useEffect(() => {
    api.algorithms().then(store.setSpecs).catch(() => {});
    const check = () => api.health().then(store.setBackendOk);
    void check();
    const timer = setInterval(check, 10_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    if (points.length === 0) return;
    store.setBusy(true);
    try {
      const result = await api.cluster(algorithm, {
        points,
        params: params[algorithm],
        record_trace: recordTrace && points.length <= 800,
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

  // Auto-run, debounced, so dragging a slider does not flood the backend.
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
  const steps = result?.trace.steps ?? [];
  const currentStep = steps[Math.min(playhead, steps.length - 1)] ?? null;

  const shownPoints = result?.projection.points_2d ?? points;
  const shownLabels = useMemo(
    () =>
      steps.length > 0
        ? labelsAt(steps, playhead, shownPoints.length)
        : (result?.labels ?? new Array(shownPoints.length).fill(-1)),
    [steps, playhead, shownPoints.length, result],
  );

  const overlay = useMemo(
    () => overlayFor(algorithm as AlgorithmKey, currentStep, shownPoints, 1),
    [algorithm, currentStep, shownPoints],
  );

  const treeFromStep = (currentStep?.payload.tree as SerialisedTree | undefined) ?? null;
  const finalTree = (result?.extras.cf_tree as SerialisedTree | undefined) ?? null;

  return (
    <div className="min-h-screen p-5" style={{ background: "var(--clay-bg)" }}>
      <header className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--clay-text)" }}>
          Clustering Explorer
        </h1>
        <ClayBadge tone={backendOk ? "good" : "warn"}>
          {backendOk ? "backend connected" : "backend unreachable"}
        </ClayBadge>
        {busy && <ClayBadge tone="accent">working…</ClayBadge>}
        <div className="ml-auto flex items-center gap-2">
          <ClayButton size="sm" onClick={store.toggleTheme}>
            {theme === "light" ? "Dark" : "Light"}
          </ClayButton>
        </div>
      </header>

      {!backendOk && (
        <ClayCard className="mb-4">
          <p className="text-xs leading-relaxed" style={{ color: "var(--clay-warn)" }}>
            The backend is not responding. Start it with{" "}
            <code>backend\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000</code>{" "}
            from the <code>backend</code> directory.
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

      <div className="mb-4" style={{ maxWidth: 420 }}>
        <ClayTabs tabs={VIEW_TABS} active={view} onChange={setView} />
      </div>

      {view === "compare" ? (
        <CompareGrid />
      ) : view === "theory" ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <TheoryPanel algorithm="dbscan" />
          <TheoryPanel algorithm="birch" />
          <TheoryPanel algorithm="cure" />
        </div>
      ) : (
        <div
          className="grid gap-4 items-start"
          style={{ gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr) minmax(260px, 340px)" }}
        >
          <div className="flex flex-col gap-4">
            <DataPanel />
            <ClayCard title="Parameters">
              <div className="mb-4">
                <ClayTabs
                  tabs={ALGO_TABS}
                  active={algorithm}
                  onChange={(id) => store.setAlgorithm(id as AlgorithmKey)}
                />
              </div>
              <ParamPanel algorithm={algorithm} />
              <ClayToggle label="Auto-run on change" checked={autoRun} onChange={store.setAutoRun} />
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
                help="Disabled automatically above 800 points."
              />
              <ClayButton variant="primary" onClick={run} disabled={points.length === 0}>
                Run {algorithm.toUpperCase()}
              </ClayButton>
            </ClayCard>
          </div>

          <div className="flex flex-col gap-4">
            <ClayCard title="Visualisation" tone="raised">
              <ScatterCanvas
                points={shownPoints}
                labels={shownLabels}
                pointTypes={result?.extras.point_types as string[] | undefined}
                overlay={overlay}
                editable={featureNames.length === 2}
                onAddPoint={(point) => store.addPoint(point)}
                onMovePoint={(index, point) => store.movePoint(index, point)}
                onRemovePoint={(index) => store.removePoint(index)}
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
              <ClayCard title="CF-tree" subtitle="Highlighted nodes are on the current insertion path">
                <CFTreeView
                  tree={treeFromStep ?? finalTree}
                  highlightPath={(currentStep?.payload.path as number[] | undefined) ?? []}
                  splitNodes={(currentStep?.payload.split_nodes as number[] | undefined) ?? []}
                />
              </ClayCard>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <MetricsPanel result={result} />
            <NarrationLog steps={steps} playhead={playhead} />
            <ClayCard title="Export">
              <ExportBar result={result} />
            </ClayCard>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `README.md`**

````markdown
# Clustering Explorer

DBSCAN, BIRCH, and CURE implemented from scratch in Python, with a React front
end that animates each algorithm step by step.

## Running it

Two processes. Open two terminals.

**Backend** (from `backend/`):

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Frontend** (from `frontend/`):

```powershell
npm run dev
```

Then open http://localhost:5173. The header shows whether the backend is
reachable.

## Tests

```powershell
cd backend; .venv\Scripts\python.exe -m pytest tests/ -v
cd frontend; npm test
```

## What is implemented from scratch

No scikit-learn, scipy, or pandas. The backend depends only on numpy, FastAPI,
and pydantic. Written by hand:

- **DBSCAN** — neighbourhood queries, core/border/noise classification, BFS
  frontier expansion.
- **BIRCH** — the CF vector `(n, LS, SS)`, radius and centroid arithmetic,
  CF-tree insertion, node splitting on the two farthest entries, and the
  weighted agglomerative second phase.
- **CURE** — farthest-first representative selection, shrinking toward the
  centroid, closest-representative merging, and sample-based labelling.
- **Metrics** — silhouette and Davies-Bouldin, both excluding noise points.
- **PCA** — via SVD, for projecting higher-dimensional data to the 2D plot.

## The trace

Each algorithm records an ordered list of steps as it runs. Every step carries a
label delta, a payload of what to draw, and one sentence of narration. The front
end replays them through the transport bar under the plot, which is what turns
each algorithm from a black box into something you can watch.

Traces use deltas rather than full label snapshots, with a keyframe every 50
steps so scrubbing backwards stays fast. Runs longer than the step budget are
compacted by merging adjacent steps, and the UI says so rather than hiding it.

## Layout

```
backend/app/algorithms/    the three algorithms and the trace recorder
backend/app/analysis/      metrics and PCA
backend/app/data/          dataset generators and file ingestion
backend/app/registry.py    parameter schemas and theory, serving both UI and docs
frontend/src/clay/         the claymorphism component set
frontend/src/features/viz/ canvas renderer, overlays, transport bar, CF-tree
```
````

- [ ] **Step 3: Manual verification checklist**

Start both servers, then confirm each of these:

1. Generate `moons` with 300 points. Run DBSCAN with eps=0.3, minPts=5. Two clusters, few noise points.
2. Press play. The eps circle moves point to point, neighbours light up, and the narration matches what the circle is doing.
3. Scrub the slider backwards. The colouring rewinds correctly and does not lag or corrupt.
4. Switch to BIRCH. The CF-tree panel appears, nodes highlight along the insertion path, and splits flash.
5. Switch to CURE. Representative rings appear and pull toward their centroids.
6. Set eps to 0.05. Everything turns to hollow grey noise dots. Metrics show em dashes rather than NaN.
7. Switch to Compare. All three render on the same data with the same point positions.
8. Import a CSV with more than two numeric columns. Pick three features. The plot shows a PCA projection and the metrics panel states the explained variance.
9. Draw mode: click to add points, drag one, right-click to delete. Clustering re-runs after each edit.
10. Export CSV, PNG, and report. All three download and open correctly.
11. Toggle dark mode. Every panel, the canvas background, and the CF-tree remain legible.
12. Stop the backend. The header badge turns to "backend unreachable" within 10 seconds and the banner explains how to restart it.

- [ ] **Step 4: Run every test one final time**

```powershell
cd backend; .venv\Scripts\python.exe -m pytest tests/ -v
cd frontend; npm test; npm run build
```

Expected: the full backend suite passes, the full frontend suite passes, and the production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx README.md
git commit -m "feat: wire up application shell with auto-run and health checks"
```

---

## Self-Review Notes

**Spec coverage.** Every section of the design doc maps to a task: §5 trace model → Task 2; §6 algorithms → Tasks 6–8; §7 data pipeline → Tasks 3, 9, 19; §8 API → Task 11; §9 frontend → Tasks 12–25; §10 testing → tests within each task.

**Interface consistency verified across tasks.** `TraceRecorder.record(kind, narration, labels_delta, payload, significant)` is called with that exact signature in Tasks 6, 7, and 8. `ClusterResult(labels, extras, trace)` is constructed identically in all three. `Transform.scale` is produced in Task 15 and consumed by every overlay in Task 17. `labelsAt(steps, upTo, pointCount)` is defined in Task 16 and called in Task 25. `overlayFor(algorithm, step, points, progress)` is defined in Task 17 and called in Task 25. `SerialisedTree` is defined in Task 18 and imported by Task 25.

**Details worth flagging to the implementer:**

1. Task 11's route ordering matters: `/cluster/compare` must be declared before `/cluster/{algorithm}`, or FastAPI will treat "compare" as an algorithm name.
2. Task 7's BIRCH module needs `from app.algorithms.trace import ClusterResult, TraceRecorder` at the top; the implementation body references both.
3. Task 12's token test asserts no custom property contains the literal `withheld`, `TODO`, or `TBD`. That guard stays — it catches the common failure where an invalid custom property silently kills a whole stylesheet.





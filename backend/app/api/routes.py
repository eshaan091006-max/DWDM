"""HTTP endpoints. These convert JSON to numpy, dispatch, and time the run."""

import time
from typing import Any

import numpy as np
from fastapi import APIRouter, File, UploadFile
from pydantic import ValidationError

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

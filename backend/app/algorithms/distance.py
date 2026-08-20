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

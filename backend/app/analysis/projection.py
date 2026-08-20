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

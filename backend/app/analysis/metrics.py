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

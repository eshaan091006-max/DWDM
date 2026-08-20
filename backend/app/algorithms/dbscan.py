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

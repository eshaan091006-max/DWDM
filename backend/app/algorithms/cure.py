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
    """Cluster X by hierarchically merging clusters of representative points."""
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

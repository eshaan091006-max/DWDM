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

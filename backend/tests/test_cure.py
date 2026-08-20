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

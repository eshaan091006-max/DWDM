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

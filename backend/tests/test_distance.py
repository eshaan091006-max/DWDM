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

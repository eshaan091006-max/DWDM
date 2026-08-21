import numpy as np

from app.analysis.projection import pca, standardize, to_display_2d


def test_pca_recovers_the_dominant_axis():
    rng = np.random.default_rng(0)
    t = rng.normal(size=200)
    # Variance lives almost entirely along the (1, 1) direction.
    X = np.column_stack([t, t]) + rng.normal(scale=0.01, size=(200, 2))
    projected, ratio = pca(X, n_components=2)
    assert projected.shape == (200, 2)
    assert ratio[0] > 0.99


def test_explained_variance_ratios_sum_to_at_most_one_and_descend():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(100, 5))
    _, ratio = pca(X, n_components=3)
    assert ratio.shape == (3,)
    assert np.all(np.diff(ratio) <= 1e-12)
    assert 0 < ratio.sum() <= 1.0 + 1e-9


def test_pca_output_is_centred():
    rng = np.random.default_rng(2)
    X = rng.normal(loc=50.0, size=(80, 4))
    projected, _ = pca(X, n_components=2)
    assert np.allclose(projected.mean(axis=0), 0.0, atol=1e-8)


def test_pca_preserves_pairwise_distance_ordering_for_planar_data():
    rng = np.random.default_rng(3)
    base = rng.normal(size=(40, 2))
    # Embed a 2D plane in 5D: PCA must recover it losslessly.
    embedding = rng.normal(size=(2, 5))
    X = base @ embedding
    projected, ratio = pca(X, n_components=2)
    assert ratio.sum() > 0.999
    d_original = np.linalg.norm(X[0] - X[1])
    d_projected = np.linalg.norm(projected[0] - projected[1])
    assert np.isclose(d_original, d_projected, rtol=1e-6)


def test_pca_handles_constant_data_without_nan():
    X = np.ones((10, 3))
    projected, ratio = pca(X, n_components=2)
    assert np.all(np.isfinite(projected))
    assert np.all(np.isfinite(ratio))


def test_standardize_gives_unit_variance():
    rng = np.random.default_rng(4)
    X = rng.normal(loc=5.0, scale=3.0, size=(200, 2))
    Z = standardize(X)
    assert np.allclose(Z.mean(axis=0), 0.0, atol=1e-9)
    assert np.allclose(Z.std(axis=0), 1.0, atol=1e-9)


def test_standardize_leaves_constant_columns_finite():
    X = np.column_stack([np.ones(10), np.arange(10.0)])
    Z = standardize(X)
    assert np.all(np.isfinite(Z))
    assert np.allclose(Z[:, 0], 0.0)


def test_to_display_2d_passes_through_two_dimensional_data():
    X = np.array([[1.0, 2.0], [3.0, 4.0]])
    shown, ratio = to_display_2d(X)
    assert np.array_equal(shown, X)
    assert ratio is None


def test_to_display_2d_pads_one_dimensional_data():
    X = np.array([[1.0], [3.0]])
    shown, ratio = to_display_2d(X)
    assert shown.shape == (2, 2)
    assert np.allclose(shown[:, 1], 0.0)
    assert ratio is None


def test_pca_always_returns_the_requested_width_for_a_single_point():
    # The SVD of a single centred point has rank 0, so only one component comes
    # back. Callers read [x, y] from every row, so a one-column result would be
    # a silently malformed point rather than a visible failure.
    projected, ratio = pca(np.array([[1.0, 2.0, 3.0, 4.0, 5.0]]), n_components=2)
    assert projected.shape == (1, 2)
    assert len(ratio) == 2
    assert np.all(np.isfinite(projected))


def test_pca_pads_when_there_are_fewer_points_than_components():
    projected, ratio = pca(np.array([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]), n_components=3)
    assert projected.shape == (2, 3)
    assert len(ratio) == 3


def test_to_display_2d_gives_two_columns_for_a_lone_high_dimensional_point():
    # The contract the scatter plot depends on, at the most degenerate input.
    shown, ratio = to_display_2d(np.array([[1.0, 2.0, 3.0, 4.0, 5.0]]))
    assert shown.shape == (1, 2)
    assert ratio is not None and len(ratio) == 2


def test_to_display_2d_projects_high_dimensional_data():
    rng = np.random.default_rng(5)
    X = rng.normal(size=(50, 7))
    shown, ratio = to_display_2d(X)
    assert shown.shape == (50, 2)
    assert ratio is not None and len(ratio) == 2

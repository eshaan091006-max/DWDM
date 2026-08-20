import numpy as np
import pytest

from app.data.generators import GENERATORS, generate


@pytest.mark.parametrize("kind", list(GENERATORS))
def test_every_generator_returns_matching_shapes(kind):
    points, labels = generate(kind, n_samples=120, noise=0.05, random_seed=7)
    assert points.shape == (120, 2)
    assert labels.shape == (120,)
    assert points.dtype == np.float64
    assert np.all(np.isfinite(points))


@pytest.mark.parametrize("kind", list(GENERATORS))
def test_generators_are_deterministic(kind):
    a, la = generate(kind, n_samples=60, random_seed=3)
    b, lb = generate(kind, n_samples=60, random_seed=3)
    assert np.array_equal(a, b)
    assert np.array_equal(la, lb)


@pytest.mark.parametrize("kind", list(GENERATORS))
def test_different_seeds_give_different_data(kind):
    a, _ = generate(kind, n_samples=60, random_seed=1)
    b, _ = generate(kind, n_samples=60, random_seed=2)
    assert not np.array_equal(a, b)


def test_blobs_are_well_separated():
    points, labels = generate("blobs", n_samples=300, noise=0.02, random_seed=0)
    assert len(np.unique(labels)) == 3
    centroids = np.array([points[labels == k].mean(axis=0) for k in range(3)])
    # Spread is the mean radial distance from a cluster's own centroid. Using
    # `.std()` on the raw (n, 2) block would flatten x and y together, so a blob
    # whose x-mean and y-mean differ would report the gap between its own axes
    # as "spread" — a number several times its actual tightness.
    spreads = np.array([
        np.linalg.norm(points[labels == k] - centroids[k], axis=1).mean()
        for k in range(3)
    ])
    pairwise = [
        np.linalg.norm(centroids[i] - centroids[j])
        for i in range(3)
        for j in range(i + 1, 3)
    ]
    assert min(pairwise) > 3 * spreads.max()


def test_moons_produce_two_interleaving_groups():
    points, labels = generate("moons", n_samples=200, noise=0.03, random_seed=0)
    assert set(np.unique(labels)) == {0, 1}
    # The moons overlap along x, which is exactly why centroid methods fail on them.
    x0 = points[labels == 0][:, 0]
    x1 = points[labels == 1][:, 0]
    assert x0.max() > x1.min()


def test_uniform_noise_has_a_single_label():
    _, labels = generate("uniform_noise", n_samples=100, random_seed=0)
    assert set(np.unique(labels)) == {0}


def test_every_generator_has_metadata():
    for key, meta in GENERATORS.items():
        assert meta["key"] == key
        assert meta["label"]
        assert meta["hint"]


def test_unknown_generator_is_rejected():
    with pytest.raises(ValueError):
        generate("spirals", n_samples=10)


def test_n_samples_is_respected_even_when_not_divisible():
    points, labels = generate("blobs", n_samples=101, random_seed=0)
    assert points.shape[0] == 101
    assert labels.shape[0] == 101

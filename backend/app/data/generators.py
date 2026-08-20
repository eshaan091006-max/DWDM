"""Synthetic datasets, chosen so each one breaks a different algorithm."""

import numpy as np

GENERATORS: dict[str, dict[str, object]] = {
    "blobs": {
        "key": "blobs",
        "label": "Gaussian blobs",
        "hint": "The easy case. All three algorithms should agree here.",
        "supports_noise": True,
    },
    "moons": {
        "key": "moons",
        "label": "Two moons",
        "hint": "Non-convex. DBSCAN nails it; BIRCH and CURE struggle.",
        "supports_noise": True,
    },
    "circles": {
        "key": "circles",
        "label": "Concentric circles",
        "hint": "Nested shapes with a shared centroid — fatal for centroid methods.",
        "supports_noise": True,
    },
    "anisotropic": {
        "key": "anisotropic",
        "label": "Anisotropic blobs",
        "hint": "Stretched diagonally. Shows why CURE uses multiple representatives.",
        "supports_noise": True,
    },
    "varied_density": {
        "key": "varied_density",
        "label": "Varied density",
        "hint": "One eps cannot fit all three densities — DBSCAN's core weakness.",
        "supports_noise": True,
    },
    "uneven_blobs": {
        "key": "uneven_blobs",
        "label": "Uneven blob sizes",
        "hint": "A huge cluster beside two tiny ones. BIRCH's threshold gets awkward.",
        "supports_noise": True,
    },
    "uniform_noise": {
        "key": "uniform_noise",
        "label": "Uniform noise",
        "hint": "No structure at all. A good sanity check: does it invent clusters?",
        "supports_noise": False,
    },
}


def _split_counts(n_samples: int, groups: int) -> list[int]:
    """Divide n_samples into `groups` parts, giving the remainder to the first."""
    base = n_samples // groups
    counts = [base] * groups
    for i in range(n_samples - base * groups):
        counts[i] += 1
    return counts


def _blobs(
    rng: np.random.Generator,
    n_samples: int,
    noise: float,
    centers: list[tuple[float, float]],
    scales: list[float],
) -> tuple[np.ndarray, np.ndarray]:
    """Build Gaussian blobs at the given centres, returning (points, labels)."""
    counts = _split_counts(n_samples, len(centers))
    chunks, labels = [], []
    for k, (center, scale, count) in enumerate(zip(centers, scales, counts)):
        chunks.append(rng.normal(loc=center, scale=scale, size=(count, 2)))
        labels.append(np.full(count, k))
    points = np.vstack(chunks) + rng.normal(scale=noise, size=(n_samples, 2))
    return points.astype(np.float64), np.concatenate(labels)


def generate(
    kind: str,
    n_samples: int = 300,
    noise: float = 0.05,
    random_seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """Return (points, ground_truth_labels) for the named dataset.

    Ground-truth labels are for display only; no algorithm ever sees them.
    """
    if kind not in GENERATORS:
        raise ValueError(f"Unknown generator {kind!r}; expected one of {sorted(GENERATORS)}")
    if n_samples < 1:
        raise ValueError("n_samples must be at least 1")

    rng = np.random.default_rng(random_seed)

    if kind == "blobs":
        return _blobs(
            rng, n_samples, noise,
            centers=[(-2.5, -2.0), (2.5, -1.5), (0.0, 2.8)],
            scales=[0.55, 0.55, 0.55],
        )

    if kind == "uneven_blobs":
        counts = _split_counts(n_samples, 10)
        big = sum(counts[:8])
        chunks = [
            rng.normal(loc=(0.0, 0.0), scale=1.6, size=(big, 2)),
            rng.normal(loc=(4.5, 3.5), scale=0.25, size=(counts[8], 2)),
            rng.normal(loc=(-4.5, 3.0), scale=0.25, size=(counts[9], 2)),
        ]
        labels = np.concatenate([
            np.zeros(big, dtype=int),
            np.full(counts[8], 1),
            np.full(counts[9], 2),
        ])
        points = np.vstack(chunks) + rng.normal(scale=noise, size=(n_samples, 2))
        return points.astype(np.float64), labels

    if kind == "varied_density":
        counts = _split_counts(n_samples, 3)
        chunks = [
            rng.normal(loc=(-3.0, 0.0), scale=0.20, size=(counts[0], 2)),
            rng.normal(loc=(0.5, 0.5), scale=0.70, size=(counts[1], 2)),
            rng.normal(loc=(4.0, -0.5), scale=1.60, size=(counts[2], 2)),
        ]
        labels = np.concatenate([np.full(c, k) for k, c in enumerate(counts)])
        points = np.vstack(chunks) + rng.normal(scale=noise, size=(n_samples, 2))
        return points.astype(np.float64), labels

    if kind == "anisotropic":
        points, labels = _blobs(
            rng, n_samples, noise,
            centers=[(-2.0, -2.0), (2.0, -1.0), (0.0, 2.5)],
            scales=[0.6, 0.6, 0.6],
        )
        transform = np.array([[0.7, -0.6], [-0.45, 0.9]])
        return (points @ transform).astype(np.float64), labels

    if kind == "moons":
        half = n_samples // 2
        rest = n_samples - half
        t_outer = np.linspace(0.0, np.pi, half)
        t_inner = np.linspace(0.0, np.pi, rest)
        outer = np.column_stack([np.cos(t_outer), np.sin(t_outer)])
        inner = np.column_stack([1.0 - np.cos(t_inner), 0.5 - np.sin(t_inner)])
        points = np.vstack([outer, inner]) + rng.normal(scale=noise, size=(n_samples, 2))
        labels = np.concatenate([np.zeros(half, dtype=int), np.ones(rest, dtype=int)])
        return (points * 2.5).astype(np.float64), labels

    if kind == "circles":
        half = n_samples // 2
        rest = n_samples - half
        t_outer = rng.uniform(0.0, 2 * np.pi, half)
        t_inner = rng.uniform(0.0, 2 * np.pi, rest)
        outer = np.column_stack([np.cos(t_outer), np.sin(t_outer)]) * 3.0
        inner = np.column_stack([np.cos(t_inner), np.sin(t_inner)]) * 1.3
        points = np.vstack([outer, inner]) + rng.normal(scale=noise * 3, size=(n_samples, 2))
        labels = np.concatenate([np.zeros(half, dtype=int), np.ones(rest, dtype=int)])
        return points.astype(np.float64), labels

    # uniform_noise
    points = rng.uniform(-4.0, 4.0, size=(n_samples, 2))
    return points.astype(np.float64), np.zeros(n_samples, dtype=int)

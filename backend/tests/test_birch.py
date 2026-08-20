import numpy as np
import pytest

from app.algorithms.birch import CFEntry, CFTree, birch
from app.data.generators import generate


def agreement(a, b):
    a, b = np.asarray(a), np.asarray(b)
    n = len(a)
    same_a = a[:, None] == a[None, :]
    same_b = b[:, None] == b[None, :]
    return float((same_a == same_b).sum() - n) / (n * n - n)


def test_cf_entry_centroid_and_radius():
    entry = CFEntry(n_features=2)
    for i, point in enumerate([np.array([0.0, 0.0]), np.array([2.0, 0.0])]):
        entry.absorb(point, i)
    assert np.allclose(entry.centroid, [1.0, 0.0])
    # ss/n - ||centroid||^2 = (0 + 4)/2 - 1 = 1
    assert np.isclose(entry.radius, 1.0)


def test_cf_additivity():
    """Merging two CFs must equal the CF of the union. This is BIRCH's foundation."""
    rng = np.random.default_rng(0)
    points = rng.normal(size=(10, 3))

    left = CFEntry(n_features=3)
    right = CFEntry(n_features=3)
    union = CFEntry(n_features=3)
    for i, p in enumerate(points[:4]):
        left.absorb(p, i)
        union.absorb(p, i)
    for i, p in enumerate(points[4:], start=4):
        right.absorb(p, i)
        union.absorb(p, i)

    left.merge(right)
    assert left.n == union.n
    assert np.allclose(left.ls, union.ls)
    assert np.isclose(left.ss, union.ss)
    assert np.allclose(left.centroid, union.centroid)
    assert np.isclose(left.radius, union.radius)


def test_radius_if_absorbed_matches_actually_absorbing():
    rng = np.random.default_rng(1)
    entry = CFEntry(n_features=2)
    for i, p in enumerate(rng.normal(size=(5, 2))):
        entry.absorb(p, i)
    candidate = np.array([1.0, 1.0])
    predicted = entry.radius_if_absorbed(candidate)
    entry.absorb(candidate, 99)
    assert np.isclose(predicted, entry.radius)


def test_no_leaf_entry_exceeds_the_threshold():
    X, _ = generate("blobs", n_samples=200, random_seed=0)
    tree = CFTree(threshold=0.5, branching_factor=6, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)
    for entry in tree.leaf_entries():
        assert entry.radius <= 0.5 + 1e-9


def test_no_node_exceeds_the_branching_factor():
    X, _ = generate("blobs", n_samples=200, random_seed=0)
    tree = CFTree(threshold=0.3, branching_factor=4, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)
    serialised = tree.serialize()
    for node in serialised["nodes"]:
        assert len(node["entries"]) <= 4


def test_every_point_lands_in_exactly_one_leaf_entry():
    X, _ = generate("blobs", n_samples=150, random_seed=0)
    tree = CFTree(threshold=0.4, branching_factor=5, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)
    seen = [idx for entry in tree.leaf_entries() for idx in entry.members]
    assert sorted(seen) == list(range(150))


def test_insert_returns_a_path_from_root_to_leaf():
    X, _ = generate("blobs", n_samples=60, random_seed=0)
    tree = CFTree(threshold=0.3, branching_factor=3, n_features=2)
    path = None
    for i, point in enumerate(X):
        path = tree.insert(point, i)
    assert path is not None and len(path) >= 1
    assert path[0] == tree.root.node_id


def test_serialized_tree_has_consistent_parent_links():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    tree = CFTree(threshold=0.3, branching_factor=3, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)
    serialised = tree.serialize()
    ids = {node["id"] for node in serialised["nodes"]}
    for node in serialised["nodes"]:
        if node["id"] == serialised["root"]:
            assert node["parent"] is None
        else:
            assert node["parent"] in ids


def test_birch_recovers_well_separated_blobs():
    X, truth = generate("blobs", n_samples=210, noise=0.02, random_seed=0)
    result = birch(X, threshold=0.4, branching_factor=8, n_clusters=3, record_trace=False)
    assert agreement(result.labels, truth) > 0.95


def test_birch_without_n_clusters_uses_leaf_entries_directly():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    result = birch(X, threshold=0.6, branching_factor=8, n_clusters=None, record_trace=False)
    assert len(set(result.labels)) == result.extras["n_leaf_entries"]


def test_birch_assigns_every_point():
    X, _ = generate("blobs", n_samples=120, random_seed=0)
    result = birch(X, threshold=0.5, branching_factor=6, n_clusters=3, record_trace=False)
    assert len(result.labels) == 120
    assert -1 not in result.labels


def test_cf_tree_is_byte_identical_across_repeated_runs():
    """Node ids must be numbered per tree, not from a module-level counter.

    The backend is a long-lived uvicorn server, so a process-global counter would
    give two identical requests different node ids — `extras["cf_tree"]` and every
    trace `path`/`split_nodes` payload would differ between runs even though the
    clustering is identical. Comparing `.labels` alone would not catch it.
    """
    X, _ = generate("blobs", n_samples=90, random_seed=0)
    first = birch(X, threshold=0.4, branching_factor=3, n_clusters=3, record_trace=False)
    second = birch(X, threshold=0.4, branching_factor=3, n_clusters=3, record_trace=False)
    assert first.labels == second.labels
    assert first.extras["cf_tree"] == second.extras["cf_tree"]


def test_non_leaf_entries_summarise_their_descendant_leaves():
    """Ancestor CFs must stay in sync with the leaves beneath them.

    `_update_path_statistics` and `_split`'s `copy_stats_from` calls jointly
    maintain this, and the arrangement is subtle: after a split the path walk
    starts from an orphaned node and no-ops for the levels that were themselves
    split, relying on the split having already baked in correct totals. Nothing
    else in this suite would catch that going stale after a refactor.
    A branching factor of 2 forces repeated cascading splits through the root.
    """
    X, _ = generate("blobs", n_samples=150, random_seed=0)
    tree = CFTree(threshold=0.25, branching_factor=2, n_features=2)
    for i, point in enumerate(X):
        tree.insert(point, i)

    def leaves_under(node):
        if node.is_leaf:
            return list(node.entries)
        return [
            leaf
            for entry in node.entries
            if entry.child is not None
            for leaf in leaves_under(entry.child)
        ]

    checked = 0
    stack = [tree.root]
    while stack:
        node = stack.pop()
        if node.is_leaf:
            continue
        for entry in node.entries:
            if entry.child is None:
                continue
            descendants = leaves_under(entry.child)
            assert entry.n == sum(d.n for d in descendants)
            assert np.allclose(entry.ls, np.sum([d.ls for d in descendants], axis=0))
            assert np.isclose(entry.ss, sum(d.ss for d in descendants))
            checked += 1
            stack.append(entry.child)
    assert checked > 0, "tree never grew past a single leaf; raise n_samples"


def test_smaller_threshold_produces_more_leaf_entries():
    X, _ = generate("blobs", n_samples=180, random_seed=0)
    coarse = birch(X, threshold=1.2, branching_factor=8, record_trace=False)
    fine = birch(X, threshold=0.2, branching_factor=8, record_trace=False)
    assert fine.extras["n_leaf_entries"] > coarse.extras["n_leaf_entries"]


def test_trace_replay_reproduces_final_labels():
    X, _ = generate("blobs", n_samples=100, random_seed=0)
    result = birch(X, threshold=0.5, branching_factor=6, n_clusters=3, record_trace=True)
    replayed = [-1] * 100
    for step in result.trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
    assert replayed == result.labels


def test_trace_carries_tree_snapshots_and_paths():
    X, _ = generate("blobs", n_samples=60, random_seed=0)
    result = birch(X, threshold=0.4, branching_factor=3, n_clusters=3, record_trace=True)
    inserts = [s for s in result.trace["steps"] if s["kind"] in ("absorb", "new_entry")]
    assert inserts
    assert "tree" in inserts[0]["payload"]
    assert "path" in inserts[0]["payload"]
    assert result.extras["cf_tree"]["nodes"]


def test_splits_are_recorded_when_the_branching_factor_is_tight():
    X, _ = generate("blobs", n_samples=150, random_seed=0)
    result = birch(X, threshold=0.15, branching_factor=3, n_clusters=3, record_trace=True)
    assert any(s["kind"] == "split" for s in result.trace["steps"])


def test_single_point_and_duplicates():
    assert birch(np.array([[1.0, 2.0]]), threshold=0.5, record_trace=False).labels == [0]
    duplicates = birch(np.zeros((8, 2)), threshold=0.5, n_clusters=1, record_trace=False)
    assert set(duplicates.labels) == {0}


def test_n_clusters_above_leaf_count_is_clamped():
    X, _ = generate("blobs", n_samples=30, random_seed=0)
    result = birch(X, threshold=5.0, branching_factor=8, n_clusters=99, record_trace=False)
    assert len(set(result.labels)) <= 30


def test_invalid_parameters_are_rejected():
    X = np.zeros((5, 2))
    with pytest.raises(ValueError):
        birch(X, threshold=0.0)
    with pytest.raises(ValueError):
        birch(X, threshold=0.5, branching_factor=1)
    with pytest.raises(ValueError):
        birch(np.zeros((0, 2)), threshold=0.5)

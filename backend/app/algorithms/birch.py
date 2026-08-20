"""BIRCH — balanced iterative reducing and clustering using hierarchies.

Phase 1 compresses the data into a height-balanced CF-tree in a single pass.
Phase 2 runs agglomerative clustering over the leaf-entry centroids, weighted by
their counts, and every original point inherits its leaf entry's label.

A clustering feature is the triple (n, LS, SS): the member count, the vector sum
of the members, and the scalar sum of their squared magnitudes. Everything BIRCH
needs — centroid, radius, and the effect of a merge — follows from those three
numbers without revisiting the points, which is the whole trick.
"""

import itertools
from typing import Any

import numpy as np

from app.algorithms.trace import ClusterResult, TraceRecorder


class CFEntry:
    """One clustering feature, optionally pointing at a child node."""

    def __init__(self, n_features: int) -> None:
        self.n = 0
        self.ls = np.zeros(n_features, dtype=np.float64)
        self.ss = 0.0
        self.child: "CFNode | None" = None
        self.members: list[int] = []
        self._n_features = n_features

    @property
    def centroid(self) -> np.ndarray:
        """The mean of the absorbed points; the origin while the entry is empty."""
        if self.n == 0:
            return np.zeros(self._n_features, dtype=np.float64)
        return self.ls / self.n

    @property
    def radius(self) -> float:
        """Root-mean-square distance from the members to their centroid."""
        if self.n == 0:
            return 0.0
        centroid = self.centroid
        value = self.ss / self.n - float(centroid @ centroid)
        return float(np.sqrt(max(0.0, value)))

    def absorb(self, point: np.ndarray, index: int) -> None:
        """Add a single point to this entry."""
        self.n += 1
        self.ls += point
        self.ss += float(point @ point)
        self.members.append(index)

    def merge(self, other: "CFEntry") -> None:
        """Add another entry's statistics into this one. CFs are additive."""
        self.n += other.n
        self.ls += other.ls
        self.ss += other.ss
        self.members.extend(other.members)

    def radius_if_absorbed(self, point: np.ndarray) -> float:
        """What this entry's radius would become if it absorbed `point`."""
        n = self.n + 1
        ls = self.ls + point
        ss = self.ss + float(point @ point)
        centroid = ls / n
        return float(np.sqrt(max(0.0, ss / n - float(centroid @ centroid))))

    def copy_stats_from(self, others: list["CFEntry"]) -> None:
        """Recompute this entry's statistics as the sum of `others`."""
        self.n = sum(o.n for o in others)
        self.ls = np.sum([o.ls for o in others], axis=0) if others else np.zeros(self._n_features)
        self.ss = sum(o.ss for o in others)
        self.members = [m for o in others for m in o.members]


class CFNode:
    """A node in the CF-tree, holding at most `branching_factor` entries."""

    def __init__(self, is_leaf: bool, n_features: int, node_id: int) -> None:
        self.node_id = node_id
        self.is_leaf = is_leaf
        self.entries: list[CFEntry] = []
        self.parent: "CFNode | None" = None
        self._n_features = n_features


class CFTree:
    """The height-balanced tree built during BIRCH's first pass."""

    def __init__(self, threshold: float, branching_factor: int, n_features: int) -> None:
        if threshold <= 0:
            raise ValueError("threshold must be greater than 0")
        if branching_factor < 2:
            raise ValueError("branching_factor must be at least 2")
        self.threshold = threshold
        self.branching_factor = branching_factor
        self.n_features = n_features
        # Node ids are numbered per tree, never from a module-level counter.
        # The backend is a long-lived server: a process-global counter would
        # hand two identical requests different ids, so `extras["cf_tree"]` and
        # every trace `path`/`split_nodes` payload would differ between runs —
        # breaking the determinism the animation depends on.
        self._next_node_id = itertools.count()
        self.root = self._new_node(is_leaf=True)
        self.last_split: list[int] = []

    def _new_node(self, is_leaf: bool) -> CFNode:
        """Create a node carrying the next id unique to this tree."""
        return CFNode(is_leaf, self.n_features, next(self._next_node_id))

    def insert(self, point: np.ndarray, index: int) -> list[int]:
        """Insert one point, returning the node-id path from root to its leaf."""
        self.last_split = []
        path: list[int] = []
        node = self.root

        while True:
            path.append(node.node_id)
            if node.is_leaf:
                break
            entry = self._closest_entry(node, point)
            assert entry.child is not None
            node = entry.child

        self._insert_into_leaf(node, point, index)
        self._update_path_statistics(node)
        return path

    def _closest_entry(self, node: CFNode, point: np.ndarray) -> CFEntry:
        """The entry whose centroid is nearest `point`; ties break by position."""
        distances = [float(np.linalg.norm(entry.centroid - point)) for entry in node.entries]
        return node.entries[int(np.argmin(distances))]

    def _insert_into_leaf(self, leaf: CFNode, point: np.ndarray, index: int) -> None:
        if leaf.entries:
            entry = self._closest_entry(leaf, point)
            if entry.radius_if_absorbed(point) <= self.threshold:
                entry.absorb(point, index)
                return

        fresh = CFEntry(self.n_features)
        fresh.absorb(point, index)
        leaf.entries.append(fresh)

        if len(leaf.entries) > self.branching_factor:
            self._split(leaf)

    def _split(self, node: CFNode) -> None:
        """Split an overfull node on its two farthest entries and propagate up."""
        self.last_split.append(node.node_id)

        entries = node.entries
        centroids = np.array([e.centroid for e in entries])
        gaps = np.linalg.norm(centroids[:, None, :] - centroids[None, :, :], axis=-1)
        a, b = np.unravel_index(int(np.argmax(gaps)), gaps.shape)

        left_entries: list[CFEntry] = []
        right_entries: list[CFEntry] = []
        for i, entry in enumerate(entries):
            to_a = float(np.linalg.norm(entry.centroid - centroids[a]))
            to_b = float(np.linalg.norm(entry.centroid - centroids[b]))
            (left_entries if to_a <= to_b else right_entries).append(entry)

        # A degenerate split (everything on one side) would loop forever.
        if not left_entries or not right_entries:
            midpoint = len(entries) // 2
            left_entries, right_entries = entries[:midpoint], entries[midpoint:]

        left = self._new_node(node.is_leaf)
        right = self._new_node(node.is_leaf)
        left.entries, right.entries = left_entries, right_entries
        for child_node in (left, right):
            for entry in child_node.entries:
                if entry.child is not None:
                    entry.child.parent = child_node

        left_summary = CFEntry(self.n_features)
        left_summary.copy_stats_from(left.entries)
        left_summary.child = left
        right_summary = CFEntry(self.n_features)
        right_summary.copy_stats_from(right.entries)
        right_summary.child = right

        parent = node.parent
        if parent is None:
            new_root = self._new_node(is_leaf=False)
            new_root.entries = [left_summary, right_summary]
            left.parent = right.parent = new_root
            self.root = new_root
            return

        parent.entries = [e for e in parent.entries if e.child is not node]
        parent.entries.extend([left_summary, right_summary])
        left.parent = right.parent = parent

        if len(parent.entries) > self.branching_factor:
            self._split(parent)

    def _update_path_statistics(self, leaf: CFNode) -> None:
        """Refresh every ancestor summary entry after an insertion."""
        node = leaf
        while node.parent is not None:
            parent = node.parent
            for entry in parent.entries:
                if entry.child is node:
                    entry.copy_stats_from(node.entries)
                    break
            node = parent

    def leaf_entries(self) -> list[CFEntry]:
        """Every entry in every leaf, left to right."""
        found: list[CFEntry] = []
        stack = [self.root]
        while stack:
            node = stack.pop()
            if node.is_leaf:
                found.extend(node.entries)
            else:
                stack.extend(e.child for e in node.entries if e.child is not None)
        return found

    def serialize(self) -> dict[str, Any]:
        """A JSON-safe tree carrying only what the visualisation draws."""
        nodes: list[dict[str, Any]] = []
        stack = [(self.root, None)]
        while stack:
            node, parent_id = stack.pop()
            entries = []
            for entry in node.entries:
                entries.append({
                    "n": entry.n,
                    "centroid": entry.centroid.tolist(),
                    "radius": entry.radius,
                    "child": entry.child.node_id if entry.child is not None else None,
                })
                if entry.child is not None:
                    stack.append((entry.child, node.node_id))
            nodes.append({
                "id": node.node_id,
                "parent": parent_id,
                "is_leaf": node.is_leaf,
                "entries": entries,
            })
        return {"nodes": nodes, "root": self.root.node_id}


def _agglomerate(centroids: np.ndarray, weights: np.ndarray, n_clusters: int) -> list[int]:
    """Weighted agglomerative clustering by centroid distance.

    Returns a cluster id per input centroid. Used for BIRCH's second phase, where
    the inputs are leaf-entry centroids rather than raw points.
    """
    m = len(centroids)
    assignment = list(range(m))
    active = {i: [i] for i in range(m)}
    sums = {i: centroids[i] * weights[i] for i in range(m)}
    counts = {i: float(weights[i]) for i in range(m)}

    while len(active) > n_clusters:
        keys = sorted(active)
        best: tuple[float, int, int] | None = None
        for a_pos, a in enumerate(keys):
            for b in keys[a_pos + 1:]:
                gap = float(np.linalg.norm(sums[a] / counts[a] - sums[b] / counts[b]))
                if best is None or gap < best[0]:
                    best = (gap, a, b)
        if best is None:
            break
        _, a, b = best
        active[a].extend(active.pop(b))
        sums[a] = sums[a] + sums[b]
        counts[a] = counts[a] + counts[b]

    for new_id, members in enumerate(active[key] for key in sorted(active)):
        for member in members:
            assignment[member] = new_id
    return assignment


def birch(
    X: np.ndarray,
    threshold: float = 0.5,
    branching_factor: int = 50,
    n_clusters: int | None = None,
    record_trace: bool = True,
    max_steps: int = 5000,
) -> ClusterResult:
    """Cluster X by building a CF-tree, then clustering its leaf entries.

    Returns a ClusterResult whose extras carry `cf_tree` (the serialised final
    tree), `n_leaf_entries`, `entry_centroids`, `entry_radii`, and `entry_labels`.
    """
    X = np.asarray(X, dtype=np.float64)
    if X.ndim != 2 or X.shape[0] == 0:
        raise ValueError("X must be a non-empty 2-D array of shape (n, d)")
    if threshold <= 0:
        raise ValueError("threshold must be greater than 0")
    if branching_factor < 2:
        raise ValueError("branching_factor must be at least 2")

    n = X.shape[0]
    rec = TraceRecorder(n, enabled=record_trace, max_steps=max_steps)
    tree = CFTree(threshold, branching_factor, X.shape[1])

    for i, point in enumerate(X):
        before = len(tree.leaf_entries())
        path = tree.insert(point, i)
        after = len(tree.leaf_entries())
        created = after > before

        kind = "new_entry" if created else "absorb"
        narration = (
            f"Point {i} does not fit any leaf entry within T={threshold:g}, "
            f"so a new entry is created ({after} leaf entries now)."
            if created
            else f"Point {i} is absorbed into the closest leaf entry, whose radius "
            f"stays within T={threshold:g}."
        )
        rec.record(
            kind,
            narration,
            payload={
                "point": i,
                "path": path,
                "tree": tree.serialize() if record_trace else {},
                "n_leaf_entries": after,
            },
            significant=created,
        )

        if tree.last_split:
            rec.record(
                "split",
                f"A node overflowed past B={branching_factor} entries, so it split "
                f"on its two farthest entries and promoted them to the parent.",
                payload={
                    "split_nodes": list(tree.last_split),
                    "tree": tree.serialize() if record_trace else {},
                },
                significant=True,
            )

    entries = tree.leaf_entries()
    centroids = np.array([entry.centroid for entry in entries])
    weights = np.array([entry.n for entry in entries], dtype=np.float64)

    target = len(entries) if n_clusters is None else max(1, min(n_clusters, len(entries)))
    entry_labels = _agglomerate(centroids, weights, target)

    delta: dict[int, int] = {}
    for entry, label in zip(entries, entry_labels):
        for member in entry.members:
            delta[member] = label

    rec.record(
        "global_cluster",
        f"Phase 2: {len(entries)} leaf entries agglomerated into {target} cluster(s); "
        f"every point inherits its entry's label.",
        labels_delta=delta,
        payload={
            "n_leaf_entries": len(entries),
            "n_clusters": target,
            "entry_centroids": centroids.tolist(),
            "entry_radii": [entry.radius for entry in entries],
            "entry_labels": entry_labels,
        },
        significant=True,
    )
    rec.record(
        "done",
        f"Finished: {target} cluster(s) from {len(entries)} leaf entries.",
        payload={"n_clusters": target},
        significant=True,
    )

    return ClusterResult(
        labels=list(rec.labels),
        extras={
            "cf_tree": tree.serialize(),
            "n_leaf_entries": len(entries),
            "entry_centroids": centroids.tolist(),
            "entry_radii": [entry.radius for entry in entries],
            "entry_labels": entry_labels,
        },
        trace=rec.finish(),
    )

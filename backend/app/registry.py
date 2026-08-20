"""One description of each algorithm, driving both the controls and the prose.

The frontend builds its parameter panels from `params` and its explainers from
`theory`, so the UI cannot offer a knob the backend will not accept, and the
help text beside a slider always matches the theory page.
"""

from typing import Any

ALGORITHMS: dict[str, dict[str, Any]] = {
    "dbscan": {
        "key": "dbscan",
        "label": "DBSCAN",
        "tagline": "Density-based clustering that finds arbitrary shapes and calls out noise.",
        "params": [
            {
                "name": "eps",
                "label": "eps (neighbourhood radius)",
                "type": "float",
                "default": 0.5,
                "min": 0.01,
                "max": 5.0,
                "step": 0.01,
                "help": "How far apart two points can be and still count as neighbours.",
            },
            {
                "name": "min_pts",
                "label": "minPts",
                "type": "int",
                "default": 5,
                "min": 1,
                "max": 50,
                "step": 1,
                "help": "How many neighbours (including itself) a point needs to be a core point.",
            },
            {
                "name": "metric",
                "label": "Distance metric",
                "type": "choice",
                "default": "euclidean",
                "options": ["euclidean", "manhattan"],
                "help": "How distance between two points is measured.",
            },
        ],
        "theory": {
            "summary": (
                "DBSCAN grows clusters outward from dense regions. It needs no cluster "
                "count, finds clusters of any shape, and is the only one of the three "
                "that can refuse to classify a point at all."
            ),
            "how_it_works": [
                "For each point, count how many points lie within eps of it (itself included).",
                "A point with at least minPts neighbours is a core point.",
                "Each unvisited core point starts a new cluster and seeds a frontier queue.",
                "The frontier absorbs neighbours; every core point it reaches extends it further.",
                "Non-core points reached by the frontier become border points and join that cluster.",
                "Points no frontier ever reaches stay labelled noise.",
            ],
            "parameters": {
                "eps": (
                    "The single most sensitive knob. Too small and everything is noise; "
                    "too large and separate clusters fuse into one. Because it is a "
                    "distance, it depends on your feature scaling."
                ),
                "min_pts": (
                    "Controls how dense a region must be to seed a cluster. A common "
                    "rule of thumb is at least the number of dimensions plus one; "
                    "raising it makes the algorithm more willing to call points noise."
                ),
                "metric": (
                    "Euclidean measures straight-line distance; Manhattan sums the "
                    "per-axis differences and tends to favour axis-aligned structure."
                ),
            },
            "complexity": (
                "O(n^2) time in this implementation, because every neighbourhood query "
                "scans all points. A spatial index such as an R-tree or k-d tree brings "
                "the average case to O(n log n)."
            ),
            "strengths": [
                "Finds arbitrarily shaped clusters, including the two-moons case.",
                "Needs no cluster count in advance.",
                "Identifies outliers explicitly instead of forcing them into a cluster.",
            ],
            "weaknesses": [
                "One global eps cannot handle clusters of very different densities.",
                "Highly sensitive to eps and to feature scaling.",
                "Struggles in high dimensions, where distances concentrate.",
                "Border points can belong to whichever cluster reaches them first.",
            ],
        },
    },
    "birch": {
        "key": "birch",
        "label": "BIRCH",
        "tagline": "Streams the data once into a compact CF-tree, then clusters the summary.",
        "params": [
            {
                "name": "threshold",
                "label": "threshold (T)",
                "type": "float",
                "default": 0.5,
                "min": 0.01,
                "max": 5.0,
                "step": 0.01,
                "help": "The largest radius a leaf entry is allowed to reach.",
            },
            {
                "name": "branching_factor",
                "label": "branching factor (B)",
                "type": "int",
                "default": 50,
                "min": 2,
                "max": 100,
                "step": 1,
                "help": "How many entries a node holds before it splits.",
            },
            {
                "name": "n_clusters",
                "label": "clusters (optional)",
                "type": "int",
                "default": None,
                "min": 1,
                "max": 20,
                "step": 1,
                "help": "Leave empty to use the leaf entries themselves as clusters.",
            },
        ],
        "theory": {
            "summary": (
                "BIRCH compresses the dataset into a height-balanced tree of clustering "
                "features in a single pass, then clusters that much smaller summary. It "
                "was designed for data too large to hold in memory."
            ),
            "how_it_works": [
                "A clustering feature stores three numbers: the count n, the vector sum LS, and the sum of squared magnitudes SS.",
                "Centroid and radius follow from those three numbers alone, so the points never need revisiting.",
                "Each incoming point descends the tree toward the closest centroid at every level.",
                "At the leaf it joins the closest entry if the entry's radius stays within T; otherwise it becomes a new entry.",
                "A node holding more than B entries splits on its two farthest entries, promoting both to the parent, which may split in turn.",
                "Phase 2 runs agglomerative clustering over the leaf-entry centroids, weighted by their counts, and every point inherits its entry's label.",
            ],
            "parameters": {
                "threshold": (
                    "Sets how much detail survives compression. A small T keeps many "
                    "small entries and preserves fine structure at the cost of memory; "
                    "a large T summarises aggressively and can merge distinct groups."
                ),
                "branching_factor": (
                    "Caps how many entries a node holds, controlling the tree's width "
                    "and height. It affects insertion cost and tree shape far more than "
                    "it affects the final clustering."
                ),
                "n_clusters": (
                    "The target for phase 2. Left empty, each leaf entry becomes its own "
                    "cluster, which shows the raw output of the compression step."
                ),
            },
            "complexity": (
                "O(n) time for the single-pass tree build, plus the cost of clustering "
                "the leaf entries. Memory is bounded by the tree, not by n, which is "
                "what makes it suitable for streaming data."
            ),
            "strengths": [
                "One pass over the data, so it scales to datasets that do not fit in memory.",
                "Naturally incremental: new points can be inserted at any time.",
                "The CF-tree is a reusable summary, not just a labelling.",
            ],
            "weaknesses": [
                "Assumes roughly spherical clusters, so it fails on moons and rings.",
                "The result depends on the order the points arrive in.",
                "T is scale-sensitive and hard to choose without inspecting the data.",
                "Handles only numeric features, since a CF is a sum.",
            ],
        },
    },
    "cure": {
        "key": "cure",
        "label": "CURE",
        "tagline": "Represents each cluster by several scattered points shrunk toward its centre.",
        "params": [
            {
                "name": "n_clusters",
                "label": "clusters (k)",
                "type": "int",
                "default": 3,
                "min": 1,
                "max": 20,
                "step": 1,
                "help": "How many clusters to stop merging at.",
            },
            {
                "name": "n_representatives",
                "label": "representatives (c)",
                "type": "int",
                "default": 5,
                "min": 1,
                "max": 20,
                "step": 1,
                "help": "How many scattered points summarise each cluster.",
            },
            {
                "name": "shrink_factor",
                "label": "shrink factor (alpha)",
                "type": "float",
                "default": 0.2,
                "min": 0.0,
                "max": 1.0,
                "step": 0.01,
                "help": "How far representatives move toward the centroid. 1 collapses them onto it.",
            },
            {
                "name": "sample_size",
                "label": "sample size (optional)",
                "type": "int",
                "default": None,
                "min": 10,
                "max": 2000,
                "step": 10,
                "help": "Cluster a random sample, then label the rest by nearest representative.",
            },
        ],
        "theory": {
            "summary": (
                "CURE sits between single-link and centroid-based clustering. Using "
                "several representatives per cluster lets it follow elongated shapes, "
                "while shrinking them toward the centroid blunts the chaining effect "
                "that outliers cause."
            ),
            "how_it_works": [
                "Optionally draw a random sample, so the expensive merging runs on fewer points.",
                "Start with every sampled point as its own cluster, each its own representative.",
                "Repeatedly merge the pair of clusters whose closest representatives are nearest.",
                "After a merge, pick up to c well-scattered members by farthest-first traversal.",
                "Shrink each representative toward the merged cluster's centroid by alpha.",
                "Stop at k clusters, then label any unsampled points by their nearest shrunken representative.",
            ],
            "parameters": {
                "n_clusters": (
                    "CURE is hierarchical, so this is simply where you cut the merge "
                    "sequence. It must be known in advance."
                ),
                "n_representatives": (
                    "With c=1 CURE degenerates toward centroid-based clustering. Raising "
                    "c lets a cluster describe a longer, more irregular shape."
                ),
                "shrink_factor": (
                    "At alpha=0 representatives sit on real boundary points, which is "
                    "expressive but outlier-prone. At alpha=1 they all collapse onto the "
                    "centroid. Values around 0.2 to 0.3 keep the shape while damping outliers."
                ),
                "sample_size": (
                    "Merging is the expensive part, so sampling is how CURE scales. The "
                    "sample must still be large enough to represent every real cluster."
                ),
            },
            "complexity": (
                "Roughly O(n^2 log n) for the merging phase on n sampled points, which is "
                "why sampling exists. Labelling the remaining points is O(n * total representatives)."
            ),
            "strengths": [
                "Handles elongated and non-spherical clusters far better than centroid methods.",
                "Shrinking gives real robustness to outliers.",
                "Sampling makes the hierarchical approach tractable on large data.",
            ],
            "weaknesses": [
                "Needs the cluster count in advance.",
                "Merging is expensive without sampling.",
                "Three interacting parameters (k, c, alpha) make tuning fiddly.",
                "A sample that misses a small cluster loses it entirely.",
            ],
        },
    },
}

# Clustering Explorer — Implementation Report

DBSCAN, BIRCH, and CURE implemented from scratch and compared on shared datasets.

> Every number in this report was measured on this machine from the committed
> code. Nothing here is quoted from a textbook without being checked against the
> implementation first — and in two places doing that check found the textbook
> figure did not describe what the code actually does.

---

## 1. What was built

| Component | Lines | Notes |
|---|---:|---|
| `algorithms/dbscan.py` | 153 | Region queries, core/border/noise, BFS frontier |
| `algorithms/birch.py` | 376 | CF vector, CF-tree, node splitting, agglomerative phase 2 |
| `algorithms/cure.py` | 215 | Farthest-first representatives, shrinking, sampling |
| `algorithms/trace.py` | 151 | Execution-trace recorder shared by all three |
| `analysis/metrics.py` | 89 | Silhouette, Davies-Bouldin |
| `analysis/projection.py` | 56 | PCA via SVD, z-score standardisation |

**171 backend tests** and **132 frontend tests** pass.

No clustering library is used anywhere. The permitted dependencies are `numpy`,
`fastapi`, `uvicorn`, `pydantic`, and `python-multipart`; the last is a form
parser required by the file-upload endpoint and touches no mathematics. The rule
applied throughout: *if a dependency would do arithmetic this project is meant to
demonstrate, it is not allowed.*

---

## 2. Results

All three algorithms on the same 150 points per dataset, `noise=0.05`, `seed=0`.
**Agreement** is the fraction of point pairs whose co-clustering matches ground
truth — 1.000 is a perfect partition, and it is invariant to how clusters are
numbered.

| Dataset | Algorithm | Clusters | Noise | Silhouette | Agreement | Time |
|---|---|---:|---:|---:|---:|---:|
| blobs | DBSCAN | 3 | 13 | 0.813 | 0.945 | 2.5 ms |
| blobs | BIRCH | 3 | 0 | 0.793 | **1.000** | 7.4 ms |
| blobs | CURE | 3 | 0 | 0.793 | **1.000** | 3232 ms |
| moons | DBSCAN | 2 | 0 | 0.324 | **1.000** | 4.1 ms |
| moons | BIRCH | 2 | 0 | 0.411 | 0.588 | 10.8 ms |
| moons | CURE | 2 | 0 | 0.324 | **1.000** | 5091 ms |
| circles | DBSCAN | 7 | 10 | 0.364 | 0.789 | 6.0 ms |
| circles | BIRCH | 2 | 0 | 0.281 | 0.523 | 24.6 ms |
| circles | CURE | 2 | 0 | 0.146 | **1.000** | 5095 ms |

### 2.1 The most important row in the table

On **moons**, BIRCH scores a *higher* silhouette than DBSCAN — 0.411 against
0.324 — while getting the answer badly wrong (0.588 agreement against DBSCAN's
perfect 1.000).

This is not a bug in either the metric or the algorithms. Silhouette rewards
clusters that are compact and spherical, because it compares each point's mean
distance to its own cluster against its mean distance to the nearest other
cluster. Two interleaving crescents are neither compact nor spherical, so the
*correct* partition scores badly and a *wrong* partition that cuts them into two
tidy blobs scores well.

**Choosing an algorithm by silhouette alone would pick the wrong one here.**
Internal validity indices encode an assumption about cluster shape, and when that
assumption is false they systematically mislead. On `circles` the same pattern
appears even more starkly: CURE recovers the rings perfectly and posts the
*lowest* silhouette of the three (0.146).

### 2.2 Per-algorithm reading

**DBSCAN** is the only one that identifies noise, and the only one needing no
cluster count. It is perfect on moons. On circles at `eps=0.6` it fragments the
rings into 7 clusters — the rings have different point densities, and one global
`eps` cannot serve both. That single limitation is the algorithm's defining
weakness.

**BIRCH** is fast and single-pass, and it is the only one that produces a
*reusable summary* of the data rather than just a labelling. It fails on both
non-convex datasets (0.588, 0.523) because a clustering feature is a centroid
plus a radius — a spherical description — and neither a crescent nor a ring is
a sphere.

**CURE** recovers all three datasets perfectly, which is the point of using
several scattered representatives per cluster instead of one centroid. It also
costs 500–2000× more time than DBSCAN on the same data. See §4.

---

## 3. Correctness: what testing actually caught

Four genuine defects were found and fixed during development. Three of them
produced plausible-looking output, which is the reason they are worth recording.

### 3.1 DBSCAN stranded its border points

The frontier expansion filtered out neighbours that had already been visited.
A non-core point visited by the outer scan was marked noise; when a core point
later reached it, the filter excluded it, so it could never be claimed.

Validated against an independently written brute-force reference over 20 random
seeds: **the original mismatched on 3 of 20.** The fix re-queues a neighbour when
it is unvisited *or* still unassigned:

```python
if k not in in_queue and (not visited[k] or rec.labels[k] == -1)
```

This is the subtle part of DBSCAN. A border point is not dense enough to extend
the frontier, but it still belongs to whichever cluster reaches it first. Getting
it wrong silently inflates the noise count.

### 3.2 BIRCH was not deterministic

CF-tree node ids came from a module-level `itertools.count()`, shared by every
tree in the process. Two identical calls returned identical labels but different
tree structures — root id 10 on the first call, 31 on the second. Tests that
compared only `labels` could never catch it. Node numbering is now per-tree.

### 3.3 A hand-computed test fixture was simply wrong

A silhouette test asserted that all four points in `[0, 1, 4, 5]` split
`[0,0 | 1,1]` share one score "by symmetry". They do not:

| Point | a | b | s |
|---|---|---|---|
| 0 (outer) | 1 | mean(4,5) = 4.5 | 7/9 ≈ 0.778 |
| 1 (inner) | 1 | mean(3,4) = 3.5 | 5/7 ≈ 0.714 |
| 4 (inner) | 1 | 3.5 | 5/7 |
| 5 (outer) | 1 | 4.5 | 7/9 |

True mean: **0.746**, not 0.778. Points on the outer edge of a cluster score
higher than points facing the neighbouring cluster; only the mirror pairs agree.
The test now spells the arithmetic out rather than asserting an opaque constant,
because the opaque constant is what let the error survive.

### 3.4 A comparative test rested on a false premise

A test asserted that CURE with 8 representatives beats centroid-style CURE on
*anisotropic* blobs. A parameter sweep showed it holds on only 2 of 4 seeds.
Those blobs are well separated, so a single centroid already handles them and
extra representatives only invite chaining — two clusters' nearest boundary
points can be far closer than the clusters themselves.

The honest claim is narrower: **multiple representatives help on shapes a
centroid cannot describe, and hurt when they invite chaining.** The test now
demonstrates it on moons, where centroid-style CURE scores 0.575–0.690 and
multi-representative CURE scores 1.000 across four seeds. A second test pins the
trade-off directly: on anisotropic data, `α=0.2` gives 0.776 and `α=0.5` gives
0.957.

---

## 4. Complexity, measured rather than quoted

CURE's merge phase is usually quoted as O(n² log n). **This implementation is
O(n³)**, because reducing n singletons to k clusters takes about n merges and
each one rescans every surviving pair to find the closest.

| n | time |
|---:|---:|
| 60 | 0.24 s |
| 120 | 1.82 s |
| 200 | 14.99 s |
| 300 | 54.31 s |

Doubling n from 150 to 300 costs roughly 8× — cubic, not quadratic. Reaching the
quoted O(n² log n) requires a heap of candidate nearest neighbours; this
implementation keeps the simpler rescan so the merge step stays readable, and
states the real cost instead of the textbook one.

This is exactly what CURE's `sample_size` parameter exists for, and it is why the
UI fills it in automatically above 150 points — always visibly, since a result
quietly computed on a subset is not the result that was asked for.

For comparison: **DBSCAN is O(n²)** here (every region query scans all points; a
spatial index would give O(n log n) average), and **BIRCH is O(n)** for its
single-pass tree build, which is the entire reason it exists.

---

## 5. Design notes

**Execution traces.** Each algorithm records an ordered list of steps as it runs:
a label delta, a payload of what to draw, and one sentence of narration. The UI
replays them. Traces travel as deltas rather than full snapshots, with a keyframe
every 50 steps so scrubbing backwards stays cheap. A test on every algorithm
asserts that replaying every delta reproduces the returned labels exactly — the
invariant that stops the animation from drifting away from the real result.

**Metrics return `null`, not zero.** Silhouette is undefined when fewer than two
clusters survive *or* when any cluster has a single member, because its `a(i)`
term is the mean distance to *other* members of the same cluster. Davies-Bouldin
has no such term, so a singleton is fine there — it simply has spread 0. The two
metrics deliberately disagree about singletons, and two tests pin that.

**PCA is display-only.** All three algorithms cluster in the data's full
dimensionality; the projection exists so that >2D data can be plotted, and the UI
reports how much variance the two shown components carry.

---

## 6. Reproducing the results

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -v
```

Run the app:

```bash
cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend && npm run dev
```

**Demo tips**

- To see the CF-tree actually branch, set BIRCH's branching factor to 3. At the
  default of 50 every entry fits in one root node and the tree renders as a
  single box — correct, but visually dull.
- ε is the single most instructive control. On `circles`, watch the ring
  fragment count change as you move it.
- Compare mode runs all three on identical points and is the fastest way to show
  the table in §2.

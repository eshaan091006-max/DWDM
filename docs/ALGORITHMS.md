# Backend Algorithms — Explanatory Reference

How DBSCAN, BIRCH, and CURE are implemented in `backend/app/`, what the
mathematics is, and why each design decision was made. Written to be read aloud
or defended in a viva.

Every formula below matches the committed code. Where the code departs from the
textbook, that is stated explicitly rather than glossed over.

**Contents**
1. [Shared foundations](#1-shared-foundations)
2. [DBSCAN](#2-dbscan)
3. [BIRCH](#3-birch)
4. [CURE](#4-cure)
5. [Quality metrics](#5-quality-metrics)
6. [Comparison](#6-comparison)
7. [Likely questions](#7-likely-questions)

---

## 1. Shared foundations

### 1.1 What is hand-written

`numpy` is used for array arithmetic only. Every clustering decision — every
distance comparison, every merge, every assignment — is written out in the
project. No scikit-learn, scipy, or pandas anywhere.

| Module | Lines | Role |
|---|---:|---|
| `algorithms/dbscan.py` | 153 | DBSCAN |
| `algorithms/birch.py` | 376 | CF vector, CF-tree, phase 2 |
| `algorithms/cure.py` | 215 | Representatives, shrinking, sampling |
| `algorithms/trace.py` | 151 | Execution-trace recorder, shared |
| `algorithms/distance.py` | 32 | The only place a metric is interpreted |
| `analysis/metrics.py` | 89 | Silhouette, Davies-Bouldin |
| `analysis/projection.py` | 56 | PCA (display only) |

### 1.2 Distance

One module interprets metric names, so no algorithm can silently disagree with
another about what "distance" means.

$$
\lVert a-b\rVert_2 = \sqrt{\textstyle\sum_t (a_t-b_t)^2}
\qquad
\lVert a-b\rVert_1 = \textstyle\sum_t \lvert a_t-b_t\rvert
$$

The squared sum is clipped at zero before the square root: floating-point error
can make an exactly-zero distance come out as a tiny negative, and `sqrt` of that
is `NaN`, which would silently poison every downstream comparison.

### 1.3 Conventions

- Labels: `-1` = noise or unassigned, `0…k-1` = clusters.
- All three cluster in the data's **full dimensionality**. PCA is display-only
  and never feeds an algorithm.
- **Determinism is mandatory.** Same input plus same parameters gives
  byte-identical output, including the trace. Ties in distance comparisons break
  by lowest index; any randomness takes an explicit `random_seed`.

Determinism matters here beyond tidiness: the UI animates a recorded trace, so a
re-run during a demo must reproduce the same animation.

### 1.4 The execution trace

Each algorithm reports what it is doing as it runs. A step carries a label delta,
a drawing payload, and one plain-English sentence.

```python
Step: { i, kind, narration, labels_delta, payload, significant, labels_snapshot }
```

Labels travel as **deltas**, not snapshots, with a full snapshot every 50 steps as
a keyframe so scrubbing backwards is cheap. The governing invariant — tested for
every algorithm on every fixture — is that **replaying every delta in order
reproduces the returned labels exactly.** Without it the animation could drift
from the real result, which would be the worst possible failure in a teaching
tool.

---

## 2. DBSCAN

> *Density-Based Spatial Clustering of Applications with Noise* — Ester,
> Kriegel, Sander & Xu, 1996.

### 2.1 The idea

Clusters are dense regions separated by sparse ones. Rather than assuming a
shape, DBSCAN grows a cluster outward from any point with enough neighbours. Two
consequences follow, and they are the reasons to choose it: it needs **no cluster
count**, and it is the only one of the three that can **refuse to classify a
point**.

### 2.2 Definitions

For radius ε and threshold *minPts*:

$$N_\varepsilon(p) = \{\, q \in X : \lVert p-q\rVert \le \varepsilon \,\}$$

$$p \text{ is \textbf{core}} \iff \lvert N_\varepsilon(p)\rvert \ge \textit{minPts}$$

**The neighbourhood includes p itself**, so `minPts = 5` means the point plus four
others. This follows the original paper. *(Some courses define it as five
neighbours excluding the point — worth checking against your notes, as it shifts
every result by one.)*

Three roles:

| Role | Condition |
|---|---|
| **Core** | at least *minPts* points within ε |
| **Border** | not core, but inside some core point's ε-neighbourhood |
| **Noise** | neither |

### 2.3 The algorithm

```
for each unvisited point p:
    mark p visited
    if p is not core:  leave it noise (provisionally) and continue
    start a new cluster; seed a queue with N(p) \ {p}
    while the queue is not empty:
        pop q
        if q unvisited:
            mark visited
            if q is core: push q's neighbours onto the queue
        if q is unassigned: assign it to this cluster
```

Points are visited in index order, which makes cluster numbering reproducible.

### 2.4 The subtle part — border points

A point can be found *before* the cluster that will own it. The outer scan may
visit a non-core point, find it sparse, and provisionally call it noise. Later a
core point reaches it, and it must be reclaimed as a **border point**.

The re-queue condition is therefore:

```python
fresh = [k for k in neighbourhoods[j]
         if k not in in_queue and (not visited[k] or rec.labels[k] == -1)]
```

Re-queue a neighbour when it is **unvisited** (it may be core and extend the
frontier) **or visited but still unassigned** (the stranded border point).
Already-assigned points are skipped, because a border point belongs to the first
cluster that reaches it.

> **This was a real bug.** The original filter tested `not visited[k]` alone,
> which stranded border points as noise permanently. It disagreed with an
> independently written brute-force reference on **3 of 20 random seeds** — while
> still producing plausible-looking clusters. It was caught only because the test
> suite compares against a reference implementation rather than checking that the
> output "looks right".

### 2.5 Cost

**O(n²)** here: every region query scans all points. A spatial index (k-d tree,
R-tree) gives O(n log n) average. The naive version is kept because it is
obviously correct and fast enough at this scale — and the complexity is stated in
the UI rather than hidden.

### 2.6 Strengths and failure modes

**Strengths.** Arbitrary shapes; no cluster count needed; explicit outliers.

**Failure modes.** One global ε cannot serve clusters of differing density —
this is the defining weakness. Very sensitive to ε and to feature scaling.
Degrades in high dimensions as distances concentrate. Border points are
assignment-order dependent.

---

## 3. BIRCH

> *Balanced Iterative Reducing and Clustering using Hierarchies* — Zhang,
> Ramakrishnan & Livny, 1996.

### 3.1 The idea

Compress the dataset in **one pass** into a height-balanced tree of summaries,
then cluster the summaries. Memory is bounded by the tree, not by *n* — it was
designed for data too large to hold in memory.

### 3.2 The clustering feature

A cluster of *n* points is summarised by three numbers:

$$\mathrm{CF} = (n,\; \mathbf{LS},\; SS), \qquad
\mathbf{LS} = \sum_i x_i, \qquad
SS = \sum_i \lVert x_i\rVert^2$$

Everything BIRCH needs follows from those three, without revisiting a point:

$$\mu = \frac{\mathbf{LS}}{n}
\qquad\qquad
R = \sqrt{\max\left(0,\; \frac{SS}{n} - \lVert\mu\rVert^2\right)}$$

*R* is the root-mean-square distance from members to their centroid. (The
`max(0, …)` guards the same floating-point underflow as §1.2.)

**CF vectors are additive** — the property the whole method rests on:

$$\mathrm{CF}_1 + \mathrm{CF}_2 = (n_1+n_2,\; \mathbf{LS}_1+\mathbf{LS}_2,\; SS_1+SS_2)$$

Merging two clusters is three additions. This is why one pass suffices, and it is
asserted directly as a test: merging two CFs must equal the CF of the union.

The same arithmetic answers "what would happen if…" without committing:

$$R_{\text{if absorbed}}(x) = \sqrt{\max\!\left(0,\; \frac{SS + \lVert x\rVert^2}{n+1} - \left\lVert\frac{\mathbf{LS}+x}{n+1}\right\rVert^2\right)}$$

### 3.3 Phase 1 — building the CF-tree

Two parameters: **threshold T** (largest radius a leaf entry may reach) and
**branching factor B** (entries per node).

```
insert(x):
    descend from the root, at each level following the entry
        whose centroid is closest to x
    at the leaf:
        if the closest entry can absorb x with R ≤ T:  absorb it
        else:                                          create a new entry
    if the node now holds more than B entries:         split
```

**Splitting.** Take the two entries whose centroids are farthest apart as seeds,
send every other entry to the nearer seed, and promote both halves to the parent
— which may split in turn, growing the root when it reaches the top.

```python
gaps = np.linalg.norm(centroids[:, None, :] - centroids[None, :, :], axis=-1)
a, b = np.unravel_index(int(np.argmax(gaps)), gaps.shape)
```

A degenerate split — every entry landing on one side, possible when centroids
coincide — would loop forever, so it falls back to a midpoint split.

### 3.4 Phase 2 — clustering the summary

The leaf entries are now a much smaller weighted dataset. Agglomerative
clustering runs over their **centroids**, weighted by entry count, merging the
closest pair until `n_clusters` remain. Each original point inherits its leaf
entry's label.

If `n_clusters` is omitted, each leaf entry *is* a cluster — which shows the raw
output of the compression step, and is useful for teaching.

### 3.5 Two implementation details worth defending

**Ancestor statistics after a split.** `_update_path_statistics` walks up from
the leaf refreshing each parent summary. After a split the walk starts from a
node that has just been replaced, so the identity check finds nothing and the
walk no-ops for exactly those levels the split already handled — `_split` bakes
the correct totals into the replacement entries itself. This is correct but
non-obvious, so there is a test that recomputes every non-leaf CF from its
descendant leaves under a branching factor of 2, which forces cascading splits
through the root.

**Node ids are per-tree.** They were once drawn from a module-level counter, so
two identical calls in one process produced identical labels but *different*
tree structures. On a long-lived server that fires on the very first repeated
request. Tests that compared only labels could never catch it.

### 3.6 Cost

**O(n)** for the single-pass build, plus the cost of clustering the leaf
entries. Memory is bounded by the tree.

### 3.7 Strengths and failure modes

**Strengths.** One pass; scales beyond memory; naturally incremental; the
CF-tree is a reusable summary, not just a labelling.

**Failure modes.** A CF is a centroid plus a radius — a **spherical**
description. Crescents and rings are neither, and BIRCH fails on both
(measured: 0.588 and 0.523 agreement). Results depend on insertion order. *T* is
scale-sensitive. Numeric features only, since a CF is a sum.

---

## 4. CURE

> *Clustering Using REpresentatives* — Guha, Rastogi & Shim, 1998.

### 4.1 The idea

Represent a cluster by **several scattered points** instead of one centroid, then
**shrink** them toward the centroid. The two knobs place CURE on a spectrum
between two classical methods.

### 4.2 The four functions

**Centroid**

$$\mu_i = \frac{1}{\lvert C_i\rvert}\sum_{x \in C_i} x$$

**Scatter selection** — farthest-first traversal, seeded from the member nearest
the centroid so the choice is deterministic rather than random:

$$r_1 = \arg\min_{x \in C_i}\lVert x-\mu_i\rVert,
\qquad
r_m = \arg\max_{x \in C_i}\ \min_{j<m}\lVert x-r_j\rVert$$

**Shrink** — the defining step:

$$r' = r + \alpha(\mu_i - r) = (1-\alpha)\,r + \alpha\,\mu_i$$

**Inter-cluster distance** — closest pair of representatives:

$$d(C_i,C_j) = \min_{p \in R_i,\ q \in R_j} \lVert p-q\rVert_2$$

### 4.3 Why this interpolates two methods

| Setting | Behaviour |
|---|---|
| α → 0, c large | representatives sit on the boundary → **single-link**, prone to chaining |
| α = 1, or c = 1 | every representative equals μ → **centroid-link** |

At α = 1 the shrink gives `r' = μ` exactly, so `d` reduces to `‖μᵢ − μⱼ‖`. That
equivalence is asserted as a test — a clean way to show what the parameter buys.

### 4.4 The algorithm

```
optionally sample s points from X
start with every sampled point its own cluster and its own representative
while more than k clusters remain:
    merge the pair whose representatives are closest
    recompute the centroid of the merged cluster
    pick up to c scattered representatives  (farthest-first)
    shrink each one α of the way toward the centroid
label any unsampled point by its nearest shrunken representative
```

### 4.5 Cost — measured, not quoted

CURE is usually quoted as O(n² log n). **This implementation is O(n³)**, because
reducing *n* singletons to *k* clusters takes about *n* merges and each rescans
every surviving pair.

| n | 60 | 120 | 200 | 300 |
|---|---:|---:|---:|---:|
| time | 0.24 s | 1.82 s | 14.99 s | 54.31 s |

Doubling 150 → 300 costs roughly 8×: cubic, confirmed. Reaching the quoted
O(n² log n) needs a heap of candidate nearest neighbours; the simpler rescan is
kept so the merge step stays readable, and the real cost is stated instead of the
textbook one.

This is precisely what `sample_size` exists for. The UI fills it in automatically
above 150 points — always visibly, because a result quietly computed on a subset
is not the result the user asked for.

### 4.6 Strengths and failure modes

**Strengths.** Handles elongated and non-convex clusters; shrinking gives genuine
outlier robustness; sampling makes a hierarchical method tractable.

**Failure modes.** Needs *k* in advance. Expensive without sampling. Three
interacting parameters (k, c, α) make tuning fiddly. A sample that misses a small
cluster loses it entirely.

**And it is not universally better.** On well-separated blobs a single centroid
already suffices, and extra representatives only invite chaining. Measured on
anisotropic data: α = 0.2 scored **0.776**, α = 0.5 scored **0.957**. Low α
follows shape but chains; higher α damps it.

---

## 5. Quality metrics

Both are hand-written, and both **exclude noise points** — a point DBSCAN
correctly identifies as an outlier should not penalise it.

### 5.1 Silhouette

For each clustered point *i*:

$$a(i) = \text{mean distance to other members of its own cluster}$$
$$b(i) = \min_{C \ne C_i}\ \text{mean distance to members of } C$$
$$s(i) = \frac{b(i)-a(i)}{\max\{a(i),\,b(i)\}} \in [-1,1]$$

The score is the mean of `s(i)`. Higher is better.

Returns `None` when fewer than two clusters survive, **or when any cluster has a
single member** — `a(i)` is the mean distance to *other* members of the same
cluster, which does not exist for a lone point. Some libraries score such points
0, which quietly drags the mean toward zero; this project reports "undefined"
instead. `None` serialises to JSON `null` and the UI shows a dash, never `NaN`.

### 5.2 Davies-Bouldin

$$S_j = \text{mean distance from members of } C_j \text{ to } \mu_j$$
$$DB = \frac{1}{k}\sum_{j}\ \max_{m \ne j} \frac{S_j + S_m}{\lVert \mu_j - \mu_m\rVert}$$

Lower is better; 0 is ideal. Coincident centroids would divide by zero, so that
case is treated as maximally bad rather than infinite.

**Davies-Bouldin does *not* special-case singletons** — it has no `a(i)`-style
term, so a lone point simply has spread 0 and the index stays well-defined. The
two metrics deliberately disagree about singletons, and two tests pin that.

### 5.3 The most important caveat

Internal indices encode an assumption about cluster shape. When that assumption
is false they **systematically mislead**.

On two moons, BIRCH scores a *higher* silhouette than DBSCAN — **0.411 against
0.324** — while getting the answer badly wrong (0.588 agreement against DBSCAN's
perfect 1.000). Silhouette rewards compact spherical clusters, so the correct
partition of two crescents scores badly and a wrong partition that cuts them into
tidy blobs scores well.

On concentric circles the same pattern is starker: CURE recovers the rings
perfectly and posts the *lowest* silhouette of the three (0.146).

**Choosing an algorithm by silhouette alone would pick the wrong one on both
datasets.**

---

## 6. Comparison

All three on identical 150-point datasets, `noise=0.05`, `seed=0`. **Agreement**
is the fraction of point pairs the labelling co-clusters the same way as ground
truth, invariant to cluster numbering.

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

**Reading it.** Everything works on blobs — that case discriminates nothing.
BIRCH fails on both non-convex sets, exactly as its spherical CF summary
predicts. DBSCAN is perfect on moons but fragments the circles into 7 clusters at
ε = 0.6, because the two rings have different densities and one ε cannot serve
both. CURE recovers all three, at 500–2000× the runtime.

| | DBSCAN | BIRCH | CURE |
|---|---|---|---|
| Needs k? | No | Optional | Yes |
| Finds noise? | Yes | No | No |
| Cluster shape | Any | Spherical | Any |
| Passes over data | Many | One | Many |
| Complexity here | O(n²) | O(n) | O(n³) |
| Key parameter | ε | T | α |

---

## 7. Likely questions

**Why does DBSCAN fragment the circles?**
The rings differ in point density. ε that is right for the dense ring is too
small for the sparse one, which breaks into pieces. This is DBSCAN's defining
limitation, and no parameter choice fixes it — it needs a variable-density
method such as OPTICS or HDBSCAN.

**Why is BIRCH so much faster?**
It touches each point once, inserting it into a tree, and then clusters only the
leaf summaries. The others repeatedly compare points against points.

**Why is CURE so slow?**
The merge loop rescans every surviving cluster pair on each of ~n merges: O(n³).
Sampling is the intended remedy and is part of the original algorithm.

**Which is best?**
None. Each encodes a different assumption. DBSCAN assumes uniform density within
a cluster; BIRCH assumes spherical clusters; CURE assumes you know *k*. Match the
assumption to the data — the §6 table shows each one winning and losing.

**Why is `minPts` counting the point itself?**
Following Ester et al. (1996), the ε-neighbourhood includes the point. It is a
convention, applied consistently — but check it against your course notes, since
some define it exclusively and every result shifts by one.

**How do you know the implementations are correct?**
174 backend tests. DBSCAN is validated against an independently written
brute-force reference over randomised inputs. BIRCH's structural invariants are
asserted directly: CF additivity, no leaf exceeding *T*, no node exceeding *B*,
every point in exactly one leaf, every ancestor CF equal to the sum of its
descendants. Silhouette and Davies-Bouldin are checked against hand-computed
values. And every algorithm's trace is checked to replay exactly to its own
returned labels.

**Did testing actually catch anything?**
Four real defects, three of which produced plausible-looking output: DBSCAN's
stranded border points (wrong on 3 of 20 seeds), BIRCH's non-deterministic node
ids, a hand-computed silhouette fixture that was simply wrong (the "by symmetry"
claim is false — outer points score 7/9, inner points 5/7, mean 0.746 not 0.778),
and a CURE comparison test resting on a false premise about where its advantage
appears.

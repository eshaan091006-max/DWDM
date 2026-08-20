"""The execution-trace machinery shared by all three algorithms.

An algorithm reports what it is doing by calling ``TraceRecorder.record`` as it
runs. The recorder keeps the running label assignment (so the algorithm never
maintains it separately) and, when tracing is enabled, buffers a replayable list
of steps that the frontend animates.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Step:
    """One recorded moment in an algorithm's execution."""

    i: int
    kind: str
    narration: str
    labels_delta: dict[int, int] = field(default_factory=dict)
    payload: dict[str, Any] = field(default_factory=dict)
    significant: bool = False
    labels_snapshot: list[int] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialise for JSON transport, with delta keys as strings."""
        return {
            "i": self.i,
            "kind": self.kind,
            "narration": self.narration,
            "labels_delta": {str(k): v for k, v in self.labels_delta.items()},
            "payload": self.payload,
            "significant": self.significant,
            "labels_snapshot": self.labels_snapshot,
        }


@dataclass
class ClusterResult:
    """What every algorithm returns."""

    labels: list[int]
    extras: dict[str, Any] = field(default_factory=dict)
    trace: dict[str, Any] = field(default_factory=dict)


class TraceRecorder:
    """Accumulates label state and, optionally, a replayable step list."""

    def __init__(
        self,
        n_points: int,
        enabled: bool = True,
        max_steps: int = 5000,
        keyframe_every: int = 50,
    ) -> None:
        self._labels = [-1] * n_points
        self._enabled = enabled
        self._max_steps = max(1, max_steps)
        self._keyframe_every = max(1, keyframe_every)
        self._steps: list[Step] = []
        self._sample_rate = 1
        self._truncated = False

    @property
    def labels(self) -> list[int]:
        """The current label assignment. Always correct, tracing or not."""
        return self._labels

    def record(
        self,
        kind: str,
        narration: str,
        labels_delta: dict[int, int] | None = None,
        payload: dict[str, Any] | None = None,
        significant: bool = False,
    ) -> None:
        """Apply a label delta and, if enabled, buffer a step describing it."""
        delta = labels_delta or {}
        for idx, label in delta.items():
            self._labels[idx] = label

        if not self._enabled:
            return

        self._steps.append(
            Step(
                i=len(self._steps),
                kind=kind,
                narration=narration,
                labels_delta=dict(delta),
                payload=payload or {},
                significant=significant,
            )
        )
        if len(self._steps) > 2 * self._max_steps:
            self._compact()

    def _compact(self) -> None:
        """Halve the buffer by merging adjacent non-significant step pairs.

        The merged step represents the state after the *later* of the two, so its
        narration and payload win and the deltas combine with the later value
        taking precedence. Significant steps are never merged away.
        """
        merged: list[Step] = []
        i = 0
        while i < len(self._steps):
            current = self._steps[i]
            can_merge = (
                i + 1 < len(self._steps)
                and not current.significant
                and not self._steps[i + 1].significant
            )
            if can_merge:
                nxt = self._steps[i + 1]
                combined = dict(current.labels_delta)
                combined.update(nxt.labels_delta)
                nxt.labels_delta = combined
                merged.append(nxt)
                i += 2
            else:
                merged.append(current)
                i += 1

        if len(merged) == len(self._steps):
            # Every step is significant; growing the buffer beats losing correctness.
            return

        self._steps = merged
        self._sample_rate *= 2
        self._truncated = True

    def finish(self) -> dict[str, Any]:
        """Renumber steps, attach keyframes, and serialise the trace."""
        for position, step in enumerate(self._steps):
            step.i = position

        replayed = [-1] * len(self._labels)
        for step in self._steps:
            for idx, label in step.labels_delta.items():
                replayed[idx] = label
            step.labels_snapshot = (
                list(replayed) if step.i % self._keyframe_every == 0 else None
            )

        return {
            "steps": [step.to_dict() for step in self._steps],
            "truncated": self._truncated,
            "sample_rate": self._sample_rate,
        }

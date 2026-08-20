from app.algorithms.trace import TraceRecorder


def test_recorder_starts_all_unassigned():
    rec = TraceRecorder(n_points=4)
    assert rec.labels == [-1, -1, -1, -1]


def test_record_applies_delta_to_live_labels():
    rec = TraceRecorder(n_points=3)
    rec.record("assign", "point 0 joins cluster 0", labels_delta={0: 0})
    rec.record("assign", "point 2 joins cluster 1", labels_delta={2: 1})
    assert rec.labels == [0, -1, 1]


def test_replaying_deltas_reproduces_final_labels():
    rec = TraceRecorder(n_points=5)
    for i in range(5):
        rec.record("assign", f"point {i}", labels_delta={i: i % 2})
    trace = rec.finish()

    replayed = [-1] * 5
    for step in trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
    assert replayed == rec.labels


def test_keyframes_agree_with_accumulated_state():
    rec = TraceRecorder(n_points=200, keyframe_every=10)
    for i in range(200):
        rec.record("assign", f"point {i}", labels_delta={i: 0})
    trace = rec.finish()

    replayed = [-1] * 200
    for step in trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
        if step["labels_snapshot"] is not None:
            assert step["labels_snapshot"] == replayed


def test_disabled_recorder_tracks_labels_but_emits_no_steps():
    rec = TraceRecorder(n_points=3, enabled=False)
    rec.record("assign", "point 0", labels_delta={0: 0})
    trace = rec.finish()
    assert rec.labels == [0, -1, -1]
    assert trace["steps"] == []


def test_compaction_respects_budget_and_preserves_final_state():
    rec = TraceRecorder(n_points=50, max_steps=20)
    for i in range(400):
        rec.record("tick", f"step {i}", labels_delta={i % 50: i % 3})
    trace = rec.finish()

    assert trace["truncated"] is True
    assert trace["sample_rate"] > 1
    assert len(trace["steps"]) <= 40

    replayed = [-1] * 50
    for step in trace["steps"]:
        for idx, label in step["labels_delta"].items():
            replayed[int(idx)] = label
    assert replayed == rec.labels


def test_significant_steps_survive_compaction():
    rec = TraceRecorder(n_points=10, max_steps=8)
    for i in range(200):
        rec.record("tick", f"step {i}", labels_delta={i % 10: 0}, significant=(i % 50 == 0))
    trace = rec.finish()
    kinds = [s["kind"] for s in trace["steps"]]
    assert kinds.count("tick") >= 1
    significant_narrations = [s["narration"] for s in trace["steps"] if s["significant"]]
    assert len(significant_narrations) == 4


def test_step_indices_are_contiguous_after_compaction():
    rec = TraceRecorder(n_points=10, max_steps=8)
    for i in range(100):
        rec.record("tick", f"step {i}", labels_delta={i % 10: 0})
    trace = rec.finish()
    assert [s["i"] for s in trace["steps"]] == list(range(len(trace["steps"])))

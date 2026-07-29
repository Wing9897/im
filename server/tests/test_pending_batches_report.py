"""Unit tests for scripts/reporting/pending_batches.py."""

from __future__ import annotations

from scripts.reporting.pending_batches import (
    build_pending_batch_report,
    format_pending_breakdown_lines,
    load_task_name_map,
    pending_task_rows,
)


def test_pending_task_rows_filters_and_sorts() -> None:
    rows = pending_task_rows(
        [
            {"taskId": "b", "queuedMessageCount": 2, "unanalyzedCount": 5},
            {"taskId": "a", "queuedMessageCount": 0, "unanalyzedCount": 1},
            {"taskId": "c", "queuedMessageCount": 5, "unanalyzedCount": 3},
        ],
        {"a": "Alpha", "b": "Beta", "c": "Gamma"},
    )

    assert [row["taskId"] for row in rows] == ["c", "b"]
    assert rows[0]["taskName"] == "Gamma"
    assert rows[1]["queuedMessageCount"] == 2


def test_pending_task_rows_ignores_non_list_input() -> None:
    assert pending_task_rows(None) == []
    assert pending_task_rows({"taskId": "x"}) == []


def test_load_task_name_map_builds_id_to_name() -> None:
    def fake_api(_method: str, path: str, **_kwargs):
        assert path == "/api/v1/tasks"
        return 200, [{"id": "t1", "name": "Task One"}, {"id": "t2"}]

    assert load_task_name_map(fake_api) == {"t1": "Task One", "t2": "t2"}


def test_build_pending_batch_report_aggregates_queue_fields() -> None:
    def fake_api(method: str, path: str, **_kwargs):
        if method == "GET" and path == "/api/v1/results/stats":
            return 200, [{"taskId": "t1", "queuedMessageCount": 3, "unanalyzedCount": 1}]
        if method == "GET" and path == "/api/v1/results/queue":
            return 200, {"analysisPaused": True, "pendingCount": 7}
        if method == "GET" and path == "/api/v1/tasks":
            return 200, [{"id": "t1", "name": "Queued Task"}]
        raise AssertionError(f"unexpected call: {method} {path}")

    report = build_pending_batch_report(fake_api)

    assert report["analysisPaused"] is True
    assert report["queuePendingCount"] == 7
    assert report["perTaskQueuedMessageCountSum"] == 3
    assert report["tasksWithQueuedBatches"] == 1
    assert report["tasks"][0]["taskName"] == "Queued Task"


def test_format_pending_breakdown_lines_limits_top_n() -> None:
    rows = [{"taskName": f"task-{index}", "queuedMessageCount": 10 - index} for index in range(6)]

    total, lines = format_pending_breakdown_lines(rows, top_n=3)

    assert total == sum(row["queuedMessageCount"] for row in rows)
    assert any("top 3 tasks" in line for line in lines)
    assert sum("queuedMessageCount=" in line for line in lines) == 3

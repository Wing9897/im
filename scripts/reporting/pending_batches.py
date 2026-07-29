"""Pending-batch queue breakdown shared by operational verify and report scripts."""

from __future__ import annotations

from typing import Callable

ApiFn = Callable[..., tuple[int, object]]


def pending_task_rows(task_stats: object, task_names: dict[str, str] | None = None) -> list[dict]:
    if not isinstance(task_stats, list):
        return []

    names = task_names or {}
    rows: list[dict] = []
    for row in task_stats:
        if not isinstance(row, dict):
            continue
        queued = int(row.get("queuedMessageCount") or 0)
        if queued <= 0:
            continue
        task_id = str(row.get("taskId") or "")
        rows.append(
            {
                "taskId": task_id,
                "taskName": names.get(task_id) or task_id,
                "queuedMessageCount": queued,
                "unanalyzedCount": int(row.get("unanalyzedCount") or 0),
            }
        )

    rows.sort(key=lambda item: (-item["queuedMessageCount"], item["taskId"]))
    return rows


def load_task_name_map(api: ApiFn) -> dict[str, str]:
    _, tasks = api("GET", "/api/v1/tasks", timeout=60)
    if not isinstance(tasks, list):
        return {}
    return {
        str(task["id"]): str(task.get("name") or task["id"])
        for task in tasks
        if isinstance(task, dict) and task.get("id")
    }


def build_pending_batch_report(api: ApiFn) -> dict:
    _, task_stats = api("GET", "/api/v1/results/stats", timeout=60)
    _, queue = api("GET", "/api/v1/results/queue", timeout=60)
    task_names = load_task_name_map(api)

    rows = pending_task_rows(task_stats, task_names)
    per_task_queued = sum(row["queuedMessageCount"] for row in rows)
    analysis_paused = bool(queue.get("analysisPaused")) if isinstance(queue, dict) else False
    pending_count = int(queue.get("pendingCount") or 0) if isinstance(queue, dict) else 0

    return {
        "analysisPaused": analysis_paused,
        "queuePendingCount": pending_count,
        "perTaskQueuedMessageCountSum": per_task_queued,
        "tasksWithQueuedBatches": len(rows),
        "tasks": rows,
    }


def format_pending_breakdown_lines(
    rows: list[dict],
    *,
    top_n: int = 5,
) -> tuple[int, list[str]]:
    """Return per-task queued sum and human-readable lines for warn output."""
    per_task_messages = sum(int(row.get("queuedMessageCount") or 0) for row in rows)
    lines = [
        f"  per-task queuedMessageCount sum={per_task_messages} (top {min(len(rows), top_n)} tasks):",
    ]
    for row in rows[:top_n]:
        name = str(row.get("taskName") or row.get("taskId") or "?")[:24]
        queued = int(row.get("queuedMessageCount") or 0)
        lines.append(f"    - {name}: queuedMessageCount={queued}")
    lines.append(
        "  action: check app_logs (category=analysis); "
        "resume via「繼續分析」or POST /system/analysis/pause paused=false"
    )
    return per_task_messages, lines


def warn_pending_batch_breakdown(
    api: ApiFn,
    queue_pending: int,
    analysis_paused: bool,
    *,
    warn: Callable[[str, str], None],
    top_n: int = 5,
) -> None:
    """When analysis is paused with backlog, print per-task queued breakdown."""
    warn(
        "analysis paused with backlog",
        f"analysisPaused={analysis_paused}, queue.pendingCount={queue_pending}; see per-task breakdown below",
    )
    _, task_stats = api("GET", "/api/v1/results/stats", timeout=60)
    if not isinstance(task_stats, list):
        warn("pending batch breakdown", "could not load /api/v1/results/stats")
        return

    task_names = load_task_name_map(api)
    rows = pending_task_rows(task_stats, task_names)
    if not rows:
        warn("pending batch breakdown", "viewer count > 0 but no per-task queuedMessageCount in stats")
        return

    _, lines = format_pending_breakdown_lines(rows, top_n=top_n)
    for line in lines:
        print(line)

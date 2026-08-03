"""Read-only aggregate queries for the viewer API."""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.queries.version_sql import task_version_join


async def fetch_viewer_stats(db: Database) -> dict[str, Any]:
    """Aggregate counts; batch and result tables use current task version only."""
    task_row = await db.fetch_one(
        "SELECT COUNT(*) AS total_tasks, "
        "SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_tasks "
        "FROM analysis_tasks"
    )
    total_tasks = int((task_row or {}).get("total_tasks") or 0)
    active_tasks = int((task_row or {}).get("active_tasks") or 0)

    batch_join = task_version_join("b")
    batch_row = await db.fetch_one(
        f"SELECT COUNT(*) AS total_batches, "
        f"SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) AS completed_batches "
        f"FROM analysis_batches b {batch_join}"
    )
    total_batches = int((batch_row or {}).get("total_batches") or 0)
    completed = int((batch_row or {}).get("completed_batches") or 0)

    version_counts = await db.fetch_all(
        "SELECT 'topics' AS kind, COUNT(*) AS c FROM trending_topics tt "
        f"{task_version_join('tt')} "
        "UNION ALL "
        "SELECT 'events', COUNT(*) FROM analysis_events ae "
        f"{task_version_join('ae')}"
    )
    by_kind = {str(row["kind"]): int(row["c"] or 0) for row in version_counts}
    topics = by_kind.get("topics", 0)
    events = by_kind.get("events", 0)

    return {
        "totalTasks": total_tasks,
        "activeTasks": active_tasks,
        "totalBatches": total_batches,
        "completedBatches": completed,
        "totalResults": topics + events,
    }


async def fetch_viewer_tasks(db: Database) -> list[dict[str, Any]]:
    rows = await db.fetch_all(
        "SELECT t.id, t.name, t.is_active, t.schedule_rrule, "
        "(SELECT MAX(b.completed_at) FROM analysis_batches b "
        " WHERE b.task_id = t.id AND b.status = 'completed' AND b.version = t.version) AS last_analysis_at "
        "FROM analysis_tasks t ORDER BY t.created_at ASC"
    )
    result: list[dict[str, Any]] = []
    for row in rows:
        entry: dict[str, Any] = {
            "id": row["id"],
            "name": row["name"],
            "isActive": bool(row["is_active"]),
        }
        if row.get("last_analysis_at"):
            entry["lastAnalysisAt"] = row["last_analysis_at"]
        if row.get("schedule_rrule"):
            entry["scheduleRrule"] = str(row["schedule_rrule"])
        result.append(entry)
    return result

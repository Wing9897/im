"""Database queries backing results endpoints (version-aware)."""

from __future__ import annotations

from typing import Any

from server.analyzer.incremental import count_unanalyzed_messages_by_task, time_range_condition
from server.db.database import Database
from server.domain.analysis_modes import AGENT_MODE
from server.queries.batch_stats import sum_queued_message_count
from server.queries.version_sql import task_version_join
from server.scheduler.task_schedule_overrides import resolve_trigger_threshold

# Wire serializer ignores hash/key columns; keep them out of list SELECT payloads.
_EVENT_LIST_COLUMNS = (
    "ae.id, ae.task_id, ae.version, ae.batch_id, ae.title, ae.body, "
    "ae.start_time, ae.end_time, ae.location, ae.latitude, ae.longitude, "
    "ae.participants_json, ae.source_message_id, ae.batch_source_channel_names, "
    "ae.created_at, ae.updated_at"
)


def _event_time_exprs(sort: str, *, alias: str = "ae") -> tuple[str, str]:
    if sort == "analyzed_at":
        return f"{alias}.created_at", f"{alias}.created_at"
    event_time_sql = f"COALESCE({alias}.start_time, m.timestamp, {alias}.created_at)"
    return event_time_sql, event_time_sql


async def query_analysis_events(
    db: Any,
    *,
    task_id: str | None,
    search: str | None,
    start_date: str | None,
    end_date: str | None,
    sort: str,
    limit: int,
    offset: int,
    has_time: bool | None,
    has_coords: bool | None,
    search_location: bool = False,
    ascending: bool = False,
    include_total: bool = True,
    task_ids: list[str] | None = None,
    require_include_in_timeline: bool = False,
    workset_ids: list[str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Fetch current-version events and optionally their total count.

    ``task_ids`` (when not None) wins over single ``task_id``. An empty list
    matches nothing. ``require_include_in_timeline`` excludes tasks that opted
    out of time planning (calendar / timeline / board timed merge).
    ``workset_ids`` (when not None) restricts to tasks in those worksets;
    an empty list matches nothing.
    """
    join = task_version_join("ae")
    messages_join = "LEFT JOIN messages m ON m.id = ae.source_message_id"
    filter_time_sql, order_time_sql = _event_time_exprs(sort)
    # COUNT only needs messages when the date window uses COALESCE(..., m.timestamp, ...).
    count_messages_join = (
        messages_join if sort != "analyzed_at" and (start_date is not None or end_date is not None) else ""
    )
    clauses: list[str] = []
    params: list[Any] = []
    if task_ids is not None:
        if not task_ids:
            return [], 0
        placeholders = ", ".join("?" for _ in task_ids)
        clauses.append(f"ae.task_id IN ({placeholders})")
        params.extend(task_ids)
    elif task_id:
        clauses.append("ae.task_id = ?")
        params.append(task_id)
    if workset_ids is not None:
        if not workset_ids:
            return [], 0
        placeholders = ", ".join("?" for _ in workset_ids)
        clauses.append(f"at.workset_id IN ({placeholders})")
        params.extend(workset_ids)
    if require_include_in_timeline:
        clauses.append("at.include_in_timeline = 1")
    if search:
        if search_location:
            clauses.append("(ae.title LIKE ? OR ae.body LIKE ? OR ae.location LIKE ?)")
            like = f"%{search}%"
            params.extend([like, like, like])
        else:
            clauses.append("(ae.title LIKE ? OR ae.body LIKE ?)")
            like = f"%{search}%"
            params.extend([like, like])
    if start_date:
        clauses.append(f"datetime({filter_time_sql}) >= datetime(?)")
        params.append(start_date)
    if end_date:
        clauses.append(f"datetime({filter_time_sql}) <= datetime(?)")
        params.append(end_date)
    if has_time is True:
        clauses.append("ae.start_time IS NOT NULL AND TRIM(ae.start_time) != ''")
    elif has_time is False:
        clauses.append("(ae.start_time IS NULL OR TRIM(ae.start_time) = '')")
    if has_coords is True:
        clauses.append("ae.latitude IS NOT NULL AND ae.longitude IS NOT NULL")
    elif has_coords is False:
        clauses.append("(ae.latitude IS NULL OR ae.longitude IS NULL)")
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    total = 0
    if include_total:
        total = int(
            await db.fetch_value(
                f"SELECT COUNT(*) FROM analysis_events ae {join} {count_messages_join} {where_sql}",
                tuple(params),
            )
            or 0
        )
    order = "ASC" if ascending else "DESC"
    rows = await db.fetch_all(
        f"SELECT {_EVENT_LIST_COLUMNS}, at.name AS task_name, at.emoji AS emoji, "
        "at.analysis_time_range AS analysis_time_range, "
        "m.platform AS source_platform, m.timestamp AS source_message_time, "
        "c.channel_name AS source_channel_name "
        f"FROM analysis_events ae {join} {messages_join} "
        "LEFT JOIN channels c ON c.platform = m.platform AND c.platform_id = m.platform_id "
        f"{where_sql} ORDER BY datetime({order_time_sql}) {order}, ae.id {order} "
        "LIMIT ? OFFSET ?",
        tuple(params + [limit, offset]),
    )
    return rows, total


async def fetch_trending_topics(db: Any, *, task_id: str | None) -> list[dict[str, Any]]:
    """Fetch ranked topics from each task's current version."""
    clauses = ["tt.rank IS NOT NULL"]
    params: list[Any] = []
    if task_id:
        clauses.insert(0, "tt.task_id = ?")
        params.append(task_id)
    return await db.fetch_all(
        "SELECT tt.*, at.name AS task_name, COUNT(tm.message_id) AS message_count "
        f"FROM trending_topics tt {task_version_join('tt')} "
        "LEFT JOIN topic_messages tm ON tm.topic_id = tt.id "
        f"WHERE {' AND '.join(clauses)} "
        "GROUP BY tt.id ORDER BY tt.rank ASC, tt.score DESC",
        tuple(params),
    )


async def fetch_trending_topic_messages(db: Any, *, topic_id: str) -> list[dict[str, Any]]:
    """Fetch source messages linked to one trending topic."""
    return await db.fetch_all(
        "SELECT m.*, c.channel_name FROM messages m "
        "JOIN topic_messages tm ON tm.message_id = m.id "
        "LEFT JOIN channels c ON c.platform = m.platform AND c.platform_id = m.platform_id "
        "WHERE tm.topic_id = ? ORDER BY m.timestamp ASC, m.id ASC",
        (topic_id,),
    )


async def fetch_processing_batches(db: Any) -> list[dict[str, Any]]:
    """Fetch processing batches associated with each task's current version."""
    return await db.fetch_all(
        "SELECT b.id, b.task_id, b.message_count, b.status, b.retry_count, "
        "b.error_message, b.prompt_tokens, b.completion_tokens, "
        "b.created_at, b.updated_at, at.name AS task_name "
        f"FROM analysis_batches b {task_version_join('b')} "
        "WHERE b.status = 'processing' ORDER BY b.created_at ASC"
    )


#: Pending batches older than this (seconds) surface as attention even without error_message.
LONG_PENDING_SECONDS = 300


async def fetch_attention_batches(db: Any) -> list[dict[str, Any]]:
    """Pending batches that need operator attention (error or long-pending)."""
    return await db.fetch_all(
        "SELECT b.id, b.task_id, b.message_count, b.status, b.retry_count, "
        "b.error_message, b.prompt_tokens, b.completion_tokens, "
        "b.created_at, b.updated_at, at.name AS task_name "
        f"FROM analysis_batches b {task_version_join('b')} "
        "WHERE b.status = 'pending' AND ("
        "  (b.error_message IS NOT NULL AND TRIM(b.error_message) != '') "
        f"  OR datetime(b.updated_at) < datetime('now', '-{LONG_PENDING_SECONDS} seconds')"
        ") ORDER BY b.updated_at ASC LIMIT 50"
    )


async def fetch_task_analysis_stats(
    db: Database,
    *,
    time_range: str | None = None,
) -> list[dict[str, Any]]:
    tasks = await db.fetch_all("SELECT * FROM analysis_tasks ORDER BY created_at ASC")
    if not tasks:
        return []

    time_sql, time_params = time_range_condition(time_range, column="b.created_at")
    time_filter = f" AND {time_sql}" if time_sql else ""

    batch_rows = await db.fetch_all(
        "SELECT b.task_id, b.id, b.status, b.message_count "
        f"FROM analysis_batches b {task_version_join('b', 'task_id')} "
        f"WHERE 1=1{time_filter} ORDER BY b.created_at ASC, b.id ASC",
        tuple(time_params),
    )
    batches_by_task: dict[str, list[dict[str, Any]]] = {}
    for row in batch_rows:
        batches_by_task.setdefault(str(row["task_id"]), []).append(row)

    analyzed_by_task = {
        str(row["task_id"]): int(row["c"] or 0)
        for row in await db.fetch_all(
            "SELECT am.task_id, COUNT(*) AS c FROM analysis_markers am "
            "JOIN analysis_batches b ON b.id = am.batch_id AND b.status = 'completed' "
            f"{task_version_join('am', 'task_id')} "
            "GROUP BY am.task_id"
        )
    }

    stats: list[dict[str, Any]] = []
    unanalyzed_by_task = await count_unanalyzed_messages_by_task(db, tasks)
    for task in tasks:
        task_id = str(task["id"])
        batches = batches_by_task.get(task_id, [])
        queued_message_count = sum_queued_message_count(batches)
        # Agent ticks use cursor / threshold / schedule — marker stats are misleading.
        if str(task.get("analysis_mode") or "") == AGENT_MODE:
            analyzed = 0
            unanalyzed = 0
        else:
            analyzed = analyzed_by_task.get(task_id, 0)
            unanalyzed = unanalyzed_by_task.get(task_id, 0)

        stats.append(
            {
                "taskId": task_id,
                "analyzedCount": analyzed,
                "unanalyzedCount": unanalyzed,
                "queuedMessageCount": queued_message_count,
                "triggerThreshold": await resolve_trigger_threshold(db, task),
            }
        )
    return stats

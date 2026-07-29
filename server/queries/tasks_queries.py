"""Database queries backing tasks endpoints."""

from __future__ import annotations

from typing import Any

import aiosqlite

from server.db.database import TransactionDb
from server.ingestion import upsert_channel
from server.queries.version_sql import version_matched_batch_on


async def fetch_task_channel_rows(db: Any, task_id: str) -> list[dict[str, Any]]:
    return await db.fetch_all(
        "SELECT platform, platform_id FROM task_channels WHERE task_id = ?",
        (task_id,),
    )


async def fetch_all_task_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT * FROM analysis_tasks ORDER BY created_at ASC")


async def fetch_all_task_channel_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT task_id, platform, platform_id FROM task_channels")


async def replace_task_channels(tx: TransactionDb, task_id: str, refs: list[tuple[str, str]]) -> None:
    """Swap a task's channel set inside the caller's open transaction."""
    await tx.execute("DELETE FROM task_channels WHERE task_id = ?", (task_id,))
    for platform, platform_id in refs:
        # upsert_channel only issues execute() calls, so TransactionDb
        # satisfies its db protocol.
        await upsert_channel(tx, platform, platform_id)
        await tx.execute(
            "INSERT OR IGNORE INTO task_channels (task_id, platform, platform_id) VALUES (?, ?, ?)",
            (task_id, platform, platform_id),
        )


async def delete_incomplete_batches(conn: aiosqlite.Connection, task_id: str) -> list[str]:
    """Delete all pending/processing batches of a task inside the caller's transaction.

    Takes the raw connection because the select needs a cursor, which the
    ``TransactionDb`` helper protocol does not expose.
    """
    async with conn.execute(
        "SELECT id FROM analysis_batches WHERE task_id = ? AND status IN ('pending', 'processing')",
        (task_id,),
    ) as cursor:
        rows = await cursor.fetchall()
    ids = [str(row["id"]) for row in rows]
    if ids:
        placeholders = ",".join("?" for _ in ids)
        await conn.execute(
            f"DELETE FROM analysis_batches WHERE id IN ({placeholders})",
            ids,
        )
    return ids


async def fetch_activity_span_rows(db: Any) -> list[dict[str, Any]]:
    """Gantt spans; only batches matching the task's current version count.

    Also surfaces the latest completed batch's project-tick summary
    (``agent_message`` / ``tool_calls_json``) for project detail UI.
    """
    batch_on = version_matched_batch_on("b", "t")
    latest_where = (
        "b2.task_id = t.id AND b2.version = t.version AND b2.status = 'completed' "
        "ORDER BY COALESCE(b2.completed_at, b2.updated_at) DESC, b2.id DESC "
        "LIMIT 1"
    )
    task_rows = await db.fetch_all(
        "SELECT t.id, t.name, t.description, t.analysis_time_range, t.is_active, "
        "MIN(CASE WHEN b.status = 'completed' THEN b.created_at END) AS earliest_start, "
        "MAX(CASE WHEN b.status = 'completed' THEN b.completed_at END) AS latest_end, "
        "SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) AS completed_count, "
        f"(SELECT b2.agent_message FROM analysis_batches b2 WHERE {latest_where}) "
        "AS last_agent_message, "
        f"(SELECT b2.tool_calls_json FROM analysis_batches b2 WHERE {latest_where}) "
        "AS last_tool_calls_json, "
        f"(SELECT b2.error_message FROM analysis_batches b2 WHERE {latest_where}) "
        "AS last_error_message, "
        f"(SELECT b2.message_count FROM analysis_batches b2 WHERE {latest_where}) "
        "AS last_message_count "
        f"FROM analysis_tasks t LEFT JOIN analysis_batches b ON {batch_on} "
        "GROUP BY t.id ORDER BY t.created_at ASC"
    )
    user_events_row = await db.fetch_one(
        "SELECT MIN(start_time) AS earliest_start, "
        "MAX(COALESCE(NULLIF(end_time, ''), start_time)) AS latest_end, "
        "COUNT(*) AS event_count FROM user_events"
    )
    if user_events_row and int(user_events_row.get("event_count") or 0) > 0:
        task_rows.append(
            {
                "id": "__user__",
                "name": "用戶或助手",
                "description": "手動或由助手建立的定時事件",
                "analysis_time_range": "all",
                "is_active": False,
                "earliest_start": user_events_row["earliest_start"],
                "latest_end": user_events_row["latest_end"],
                "completed_count": user_events_row["event_count"],
                "last_agent_message": None,
                "last_tool_calls_json": None,
                "last_error_message": None,
                "last_message_count": None,
            }
        )
    return task_rows


async def insert_analysis_task(
    tx: TransactionDb,
    *,
    task_id: str,
    name: str,
    description: str | None,
    prompt_template: str,
    analysis_mode: str,
    analysis_time_range: str,
    schedule_type: str,
    schedule_value: str | None,
    rrule: str | None,
    event_start_time: str | None,
    event_end_time: str | None,
    event_is_all_day: int,
    event_location: str | None,
    event_description: str | None,
    include_in_timeline: int = 1,
    parent_task_id: str | None = None,
    project_wave_interval_seconds: int | None = None,
    batch_overlap_count: int | None = None,
    analysis_trigger_threshold: int | None = None,
    analysis_batch_message_limit: int | None = None,
    analysis_strategy_mode: str | None = None,
    now: str,
) -> None:
    await tx.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, "
        "analysis_mode, analysis_time_range, version, is_active, schedule_type, "
        "schedule_value, rrule, event_start_time, event_end_time, event_is_all_day, "
        "event_location, event_description, include_in_timeline, parent_task_id, "
        "project_wave_interval_seconds, batch_overlap_count, "
        "analysis_trigger_threshold, analysis_batch_message_limit, "
        "analysis_strategy_mode, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            task_id,
            name,
            description,
            prompt_template,
            analysis_mode,
            analysis_time_range,
            schedule_type,
            schedule_value,
            rrule,
            event_start_time,
            event_end_time,
            event_is_all_day,
            event_location,
            event_description,
            include_in_timeline,
            parent_task_id,
            project_wave_interval_seconds,
            batch_overlap_count,
            analysis_trigger_threshold,
            analysis_batch_message_limit,
            analysis_strategy_mode,
            now,
            now,
        ),
    )


async def update_analysis_task(
    tx: TransactionDb,
    *,
    task_id: str,
    name: str,
    description: str | None,
    prompt_template: str,
    analysis_mode: str,
    analysis_time_range: str,
    version: int,
    schedule_type: str,
    schedule_value: str | None,
    rrule: str | None,
    event_start_time: str | None,
    event_end_time: str | None,
    event_is_all_day: int,
    event_location: str | None,
    event_description: str | None,
    include_in_timeline: int = 1,
    parent_task_id: str | None = None,
    project_wave_interval_seconds: int | None = None,
    batch_overlap_count: int | None = None,
    analysis_trigger_threshold: int | None = None,
    analysis_batch_message_limit: int | None = None,
    analysis_strategy_mode: str | None = None,
    now: str,
) -> None:
    await tx.execute(
        "UPDATE analysis_tasks SET name = ?, description = ?, prompt_template = ?, "
        "analysis_mode = ?, analysis_time_range = ?, version = ?, schedule_type = ?, "
        "schedule_value = ?, rrule = ?, event_start_time = ?, event_end_time = ?, "
        "event_is_all_day = ?, event_location = ?, event_description = ?, "
        "include_in_timeline = ?, parent_task_id = ?, "
        "project_wave_interval_seconds = ?, batch_overlap_count = ?, "
        "analysis_trigger_threshold = ?, analysis_batch_message_limit = ?, "
        "analysis_strategy_mode = ?, updated_at = ? WHERE id = ?",
        (
            name,
            description,
            prompt_template,
            analysis_mode,
            analysis_time_range,
            version,
            schedule_type,
            schedule_value,
            rrule,
            event_start_time,
            event_end_time,
            event_is_all_day,
            event_location,
            event_description,
            include_in_timeline,
            parent_task_id,
            project_wave_interval_seconds,
            batch_overlap_count,
            analysis_trigger_threshold,
            analysis_batch_message_limit,
            analysis_strategy_mode,
            now,
            task_id,
        ),
    )


async def set_task_active(db: Any, task_id: str, is_active: int, now: str) -> None:
    await db.execute(
        "UPDATE analysis_tasks SET is_active = ?, updated_at = ? WHERE id = ?",
        (is_active, now, task_id),
    )


async def delete_analysis_task(db: Any, task_id: str) -> None:
    # RRULE occurrence dismissals use event_id = "{task_id}:{YYYYMMDDTHHMMSSZ}".
    await db.execute(
        "DELETE FROM timeline_dismissals WHERE source = 'recurring' AND event_id LIKE ?",
        (f"{task_id}:%",),
    )
    await db.execute("DELETE FROM analysis_tasks WHERE id = ?", (task_id,))

"""Database queries backing tasks endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import aiosqlite

from server.db.database import TransactionDb
from server.ingestion import upsert_channel
from server.queries.version_sql import version_matched_batch_on
from server.worksets_const import SYSTEM_WORKSET_DEFAULT_NAME, SYSTEM_WORKSET_ID

_TASK_WITH_SCHEDULE_SELECT = """
SELECT t.*,
       rs.rrule,
       rs.dtstart AS event_start_time,
       rs.dtend AS event_end_time,
       COALESCE(rs.is_all_day, 0) AS event_is_all_day,
       rs.location AS event_location,
       rs.description AS event_description,
       rs.timezone AS event_timezone,
       rs.timezone_ical AS event_timezone_ical,
       rs.dtstart AS event_start_local,
       rs.dtend AS event_end_local,
       COALESCE(rs.exdates_json, '[]') AS event_exdates_json,
       COALESCE(rs.rdates_json, '[]') AS event_rdates_json,
       rs.ics_uid,
       rs.ics_source,
       rs.ics_import_fingerprint,
       rs.parent_task_id
FROM analysis_tasks t
LEFT JOIN recurring_schedules rs ON rs.task_id = t.id
"""


async def fetch_task_channel_rows(db: Any, task_id: str) -> list[dict[str, Any]]:
    return await db.fetch_all(
        "SELECT platform, platform_id FROM task_channels WHERE task_id = ?",
        (task_id,),
    )


async def fetch_all_task_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all(f"{_TASK_WITH_SCHEDULE_SELECT} ORDER BY t.created_at ASC")


async def fetch_task_row(db: Any, task_id: str) -> dict[str, Any] | None:
    return await db.fetch_one(f"{_TASK_WITH_SCHEDULE_SELECT} WHERE t.id = ?", (task_id,))


async def fetch_task_workset_id(db: Any, task_id: str) -> str | None:
    row = await db.fetch_one("SELECT workset_id FROM analysis_tasks WHERE id = ?", (task_id,))
    if row is None or not row.get("workset_id"):
        return None
    return str(row["workset_id"])


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

    Appends one ``source_kind=workset`` row per ``user_events.workset_id``
    that has events (wire ``worksetId`` authoritative; ``taskId`` null).
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
    # One Gantt row per workset that owns user_events (row key = workset_id;
    # wire sourceKind=workset, worksetId set, taskId null).
    workset_span_rows = await db.fetch_all(
        "SELECT ue.workset_id AS id, "
        "COALESCE(NULLIF(w.name, ''), ?) AS name, "
        "MIN(ue.start_time) AS earliest_start, "
        "MAX(COALESCE(NULLIF(ue.end_time, ''), ue.start_time)) AS latest_end, "
        "COUNT(*) AS event_count "
        "FROM user_events ue "
        "LEFT JOIN worksets w ON w.id = ue.workset_id "
        "GROUP BY ue.workset_id "
        "ORDER BY MIN(ue.start_time) ASC, ue.workset_id ASC",
        (SYSTEM_WORKSET_DEFAULT_NAME,),
    )
    for ws_row in workset_span_rows:
        if int(ws_row.get("event_count") or 0) <= 0:
            continue
        workset_id = str(ws_row.get("id") or "").strip() or SYSTEM_WORKSET_ID
        task_rows.append(
            {
                "id": workset_id,
                "workset_id": workset_id,
                "name": str(ws_row.get("name") or SYSTEM_WORKSET_DEFAULT_NAME),
                "description": "手動或由助手建立的定時事件",
                "analysis_time_range": "all",
                "is_active": False,
                "earliest_start": ws_row["earliest_start"],
                "latest_end": ws_row["latest_end"],
                "completed_count": ws_row["event_count"],
                "last_agent_message": None,
                "last_tool_calls_json": None,
                "last_error_message": None,
                "last_message_count": None,
                "source_kind": "workset",
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
    schedule_rrule: str | None,
    include_in_timeline: int = 1,
    workset_id: str | None = None,
    web_search_query: str = "",
    project_wave_interval_seconds: int | None = None,
    batch_overlap_count: int | None = None,
    analysis_trigger_threshold: int | None = None,
    analysis_batch_message_limit: int | None = None,
    analysis_strategy_mode: str | None = None,
    rrule: str | None = None,
    event_start_time: str | None = None,
    event_end_time: str | None = None,
    event_is_all_day: int = 0,
    event_location: str | None = None,
    event_description: str | None = None,
    parent_task_id: str | None = None,
    now: str,
) -> None:
    await tx.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, "
        "web_search_query, analysis_mode, analysis_time_range, version, is_active, "
        "schedule_rrule, include_in_timeline, workset_id, "
        "project_wave_interval_seconds, batch_overlap_count, "
        "analysis_trigger_threshold, analysis_batch_message_limit, "
        "analysis_strategy_mode, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            task_id,
            name,
            description,
            prompt_template,
            web_search_query or "",
            analysis_mode,
            analysis_time_range,
            schedule_rrule,
            include_in_timeline,
            workset_id,
            project_wave_interval_seconds,
            batch_overlap_count,
            analysis_trigger_threshold,
            analysis_batch_message_limit,
            analysis_strategy_mode,
            now,
            now,
        ),
    )
    if rrule is not None:
        dtstart = event_start_time
        if dtstart and len(dtstart.strip()) <= 5:
            dtstart = f"{datetime.now().astimezone().date().isoformat()}T{dtstart.strip()}:00"
        if not dtstart:
            dtstart = datetime.now().astimezone().replace(tzinfo=None, microsecond=0).isoformat()
        dtend = event_end_time
        if dtend and len(dtend.strip()) <= 5:
            dtend = f"{dtstart[:10]}T{dtend.strip()}:00"
        await tx.execute(
            "INSERT INTO recurring_schedules "
            "(task_id, rrule, dtstart, dtend, is_all_day, location, description, timezone, "
            "parent_task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'floating', ?, ?, ?)",
            (
                task_id,
                rrule,
                dtstart,
                dtend,
                event_is_all_day,
                event_location,
                event_description,
                parent_task_id,
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
    schedule_rrule: str | None,
    include_in_timeline: int = 1,
    workset_id: str | None = None,
    web_search_query: str = "",
    project_wave_interval_seconds: int | None = None,
    batch_overlap_count: int | None = None,
    analysis_trigger_threshold: int | None = None,
    analysis_batch_message_limit: int | None = None,
    analysis_strategy_mode: str | None = None,
    now: str,
) -> None:
    await tx.execute(
        "UPDATE analysis_tasks SET name = ?, description = ?, prompt_template = ?, "
        "web_search_query = ?, analysis_mode = ?, analysis_time_range = ?, version = ?, "
        "schedule_rrule = ?, include_in_timeline = ?, workset_id = ?, "
        "project_wave_interval_seconds = ?, batch_overlap_count = ?, "
        "analysis_trigger_threshold = ?, analysis_batch_message_limit = ?, "
        "analysis_strategy_mode = ?, updated_at = ? WHERE id = ?",
        (
            name,
            description,
            prompt_template,
            web_search_query or "",
            analysis_mode,
            analysis_time_range,
            version,
            schedule_rrule,
            include_in_timeline,
            workset_id,
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

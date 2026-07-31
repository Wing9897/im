"""Raw calendar read queries; normalization stays in ``server.calendar.query``."""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.queries.version_sql import task_version_join


async def fetch_calendar_rows(
    db: Database,
    analysis_modes: tuple[str, ...],
) -> list[dict[str, Any]]:
    placeholders = ",".join("?" for _ in analysis_modes)
    return await db.fetch_all(
        "SELECT id, name, analysis_mode, is_active, rrule, event_location, "
        "event_description, event_is_all_day, event_start_time, event_end_time, event_timezone, "
        "created_at, updated_at "
        "FROM analysis_tasks "
        f"WHERE analysis_mode IN ({placeholders}) "
        "ORDER BY created_at ASC, id ASC",
        analysis_modes,
    )


async def fetch_active_calendar_task_rows(
    db: Database,
    *,
    task_id: str | None = None,
    task_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    if task_ids is not None:
        cleaned = [str(value).strip() for value in task_ids if str(value).strip()]
        if not cleaned:
            return []
        placeholders = ",".join("?" for _ in cleaned)
        return await db.fetch_all(
            "SELECT * FROM analysis_tasks WHERE analysis_mode = 'recurring' AND is_active = 1 "
            f"AND (id IN ({placeholders}) OR parent_task_id IN ({placeholders}))",
            tuple(cleaned) + tuple(cleaned),
        )
    if task_id:
        return await db.fetch_all(
            "SELECT * FROM analysis_tasks WHERE analysis_mode = 'recurring' AND is_active = 1 "
            "AND (id = ? OR parent_task_id = ?)",
            (task_id, task_id),
        )
    return await db.fetch_all("SELECT * FROM analysis_tasks WHERE analysis_mode = 'recurring' AND is_active = 1")


async def fetch_analysis_event_detail(
    db: Database,
    event_id: str,
) -> dict[str, Any] | None:
    join = task_version_join("ae")
    return await db.fetch_one(
        "SELECT ae.*, at.name AS task_name, "
        "m.timestamp AS source_message_time, m.platform AS source_platform, "
        "c.channel_name AS source_channel_name "
        f"FROM analysis_events ae {join} "
        "LEFT JOIN messages m ON m.id = ae.source_message_id "
        "LEFT JOIN channels c ON c.platform = m.platform AND c.platform_id = m.platform_id "
        "WHERE ae.id = ?",
        (event_id,),
    )


async def fetch_user_event(db: Database, event_id: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM user_events WHERE id = ?", (event_id,))

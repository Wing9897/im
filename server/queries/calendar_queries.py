"""Raw calendar read queries; normalization stays in ``server.calendar.query``."""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.queries.recurring_series_queries import SERIES_SELECT
from server.queries.version_sql import task_version_join

#: Synthetic NULL event_* columns so analysis tasks share the calendar-list shape.
TASK_CALENDAR_NULL_EVENT_COLS = (
    "NULL AS rrule, NULL AS event_location, NULL AS event_description, "
    "0 AS event_is_all_day, NULL AS event_start_time, NULL AS event_end_time, "
    "NULL AS event_timezone"
)


async def fetch_calendar_rows(
    db: Database,
    analysis_modes: tuple[str, ...],
) -> list[dict[str, Any]]:
    """Metadata for AI timeline-owning tasks (recurring series are listed separately)."""
    placeholders = ",".join("?" for _ in analysis_modes)
    return await db.fetch_all(
        "SELECT t.id, t.name, t.analysis_mode, t.is_active, "
        f"{TASK_CALENDAR_NULL_EVENT_COLS}, "
        "t.created_at, t.updated_at "
        "FROM analysis_tasks t "
        f"WHERE t.analysis_mode IN ({placeholders}) "
        "ORDER BY t.created_at ASC, t.id ASC",
        analysis_modes,
    )


async def fetch_recurring_series_rows(
    db: Database,
    *,
    series_id: str | None = None,
    series_ids: list[str] | None = None,
    parent_task_id: str | None = None,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    """Standalone recurring series rows (metadata / RRULE expand).

    Default ``include_inactive=False`` keeps expand/list active-only.
    Pass ``include_inactive=True`` for agent metadata discovery (resume-by-name).

    When ``series_ids`` is set, include those series **or** children whose
    ``parent_task_id`` is in the list (agent project scope via parent task id).
    When ``series_id`` is set, include that series **or** children of that id
    when it is used as a parent-task filter key (same dual role as before).
    """
    where_active = "" if include_inactive else " WHERE is_active = 1"
    base = f"{SERIES_SELECT}{where_active}"
    joiner = " AND " if where_active else " WHERE "
    if series_ids is not None:
        cleaned = [str(value).strip() for value in series_ids if str(value).strip()]
        if not cleaned:
            return []
        placeholders = ",".join("?" for _ in cleaned)
        return await db.fetch_all(
            f"{base}{joiner}(id IN ({placeholders}) OR parent_task_id IN ({placeholders}))",
            tuple(cleaned) + tuple(cleaned),
        )
    if series_id:
        return await db.fetch_all(
            f"{base}{joiner}(id = ? OR parent_task_id = ?)",
            (series_id, series_id),
        )
    if parent_task_id:
        return await db.fetch_all(
            f"{base}{joiner}parent_task_id = ?",
            (parent_task_id,),
        )
    return await db.fetch_all(base)


async def fetch_active_recurring_series_rows(
    db: Database,
    *,
    series_id: str | None = None,
    series_ids: list[str] | None = None,
    parent_task_id: str | None = None,
) -> list[dict[str, Any]]:
    """Active standalone series for RRULE expand (never includes paused)."""
    return await fetch_recurring_series_rows(
        db,
        series_id=series_id,
        series_ids=series_ids,
        parent_task_id=parent_task_id,
        include_inactive=False,
    )


async def fetch_analysis_event_detail(
    db: Database,
    event_id: str,
) -> dict[str, Any] | None:
    join = task_version_join("ae")
    return await db.fetch_one(
        "SELECT ae.*, at.name AS task_name, at.emoji AS emoji, "
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

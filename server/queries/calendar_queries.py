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
        "SELECT t.id, t.name, t.analysis_mode, t.is_active, rs.rrule, rs.location AS event_location, "
        "rs.description AS event_description, COALESCE(rs.is_all_day, 0) AS event_is_all_day, "
        "rs.dtstart AS event_start_time, rs.dtend AS event_end_time, rs.timezone AS event_timezone, "
        "t.created_at, t.updated_at "
        "FROM analysis_tasks t LEFT JOIN recurring_schedules rs ON rs.task_id = t.id "
        f"WHERE t.analysis_mode IN ({placeholders}) "
        "ORDER BY t.created_at ASC, t.id ASC",
        analysis_modes,
    )


async def fetch_active_recurring_task_rows(
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
            "SELECT t.*, rs.rrule, rs.dtstart AS event_start_time, rs.dtend AS event_end_time, "
            "rs.is_all_day AS event_is_all_day, rs.location AS event_location, "
            "rs.description AS event_description, rs.timezone AS event_timezone, "
            "rs.timezone_ical AS event_timezone_ical, rs.dtstart AS event_start_local, "
            "rs.dtend AS event_end_local, rs.exdates_json AS event_exdates_json, "
            "rs.rdates_json AS event_rdates_json, rs.ics_source, rs.parent_task_id "
            "FROM analysis_tasks t JOIN recurring_schedules rs ON rs.task_id = t.id "
            "WHERE t.analysis_mode = 'recurring' AND t.is_active = 1 "
            f"AND (t.id IN ({placeholders}) OR rs.parent_task_id IN ({placeholders}))",
            tuple(cleaned) + tuple(cleaned),
        )
    if task_id:
        return await db.fetch_all(
            "SELECT t.*, rs.rrule, rs.dtstart AS event_start_time, rs.dtend AS event_end_time, "
            "rs.is_all_day AS event_is_all_day, rs.location AS event_location, "
            "rs.description AS event_description, rs.timezone AS event_timezone, "
            "rs.timezone_ical AS event_timezone_ical, rs.dtstart AS event_start_local, "
            "rs.dtend AS event_end_local, rs.exdates_json AS event_exdates_json, "
            "rs.rdates_json AS event_rdates_json, rs.ics_source, rs.parent_task_id "
            "FROM analysis_tasks t JOIN recurring_schedules rs ON rs.task_id = t.id "
            "WHERE t.analysis_mode = 'recurring' AND t.is_active = 1 "
            "AND (t.id = ? OR rs.parent_task_id = ?)",
            (task_id, task_id),
        )
    return await db.fetch_all(
        "SELECT t.*, rs.rrule, rs.dtstart AS event_start_time, rs.dtend AS event_end_time, "
        "rs.is_all_day AS event_is_all_day, rs.location AS event_location, "
        "rs.description AS event_description, rs.timezone AS event_timezone, "
        "rs.timezone_ical AS event_timezone_ical, rs.dtstart AS event_start_local, "
        "rs.dtend AS event_end_local, rs.exdates_json AS event_exdates_json, "
        "rs.rdates_json AS event_rdates_json, rs.ics_source, rs.parent_task_id "
        "FROM analysis_tasks t JOIN recurring_schedules rs ON rs.task_id = t.id "
        "WHERE t.analysis_mode = 'recurring' AND t.is_active = 1"
    )


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

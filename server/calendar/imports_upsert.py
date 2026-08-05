"""Atomic UID upsert helpers for ICS calendar import commit."""

from __future__ import annotations

import json
from typing import Any

from server.calendar.ics import ParsedIcsEvent
from server.worksets_const import SYSTEM_WORKSET_ID


async def _upsert_user_event(
    conn: Any,
    *,
    event: ParsedIcsEvent,
    source: str,
    existing_id: str | None,
    now: str,
) -> tuple[str, str]:
    # Lazy facade lookup so tests can monkeypatch ``server.calendar.imports.new_id``.
    from server.calendar import imports as imports_mod

    if existing_id is None:
        event_id = imports_mod.new_id()
        await conn.execute(
            "INSERT INTO user_events "
            "(id, title, body, start_time, end_time, location, origin, event_is_all_day, "
            "event_timezone, ics_uid, ics_source, ics_import_fingerprint, task_id, workset_id, "
            "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ics', ?, ?, ?, ?, ?, NULL, ?, ?, ?)",
            (
                event_id,
                event.title,
                event.description,
                event.start_time,
                event.end_time,
                event.location,
                1 if event.is_all_day else 0,
                event.timezone_id,
                event.uid,
                source,
                event.fingerprint,
                SYSTEM_WORKSET_ID,
                now,
                now,
            ),
        )
        return event_id, "created"
    await conn.execute(
        "UPDATE user_events SET title = ?, body = ?, start_time = ?, end_time = ?, location = ?, "
        "origin = 'ics', event_is_all_day = ?, event_timezone = ?, ics_import_fingerprint = ?, "
        "updated_at = ? WHERE id = ?",
        (
            event.title,
            event.description,
            event.start_time,
            event.end_time,
            event.location,
            1 if event.is_all_day else 0,
            event.timezone_id,
            event.fingerprint,
            now,
            existing_id,
        ),
    )
    return existing_id, "updated"


async def _upsert_recurring_task(
    conn: Any,
    *,
    event: ParsedIcsEvent,
    source: str,
    existing_id: str | None,
    now: str,
) -> tuple[str, str]:
    from server.calendar import imports as imports_mod

    assert event.rrule is not None
    exdates_json = json.dumps(event.exdates, ensure_ascii=False, separators=(",", ":"))
    rdates_json = json.dumps(event.rdates, ensure_ascii=False, separators=(",", ":"))
    if existing_id is None:
        task_id = imports_mod.new_id()
        await conn.execute(
            "INSERT INTO analysis_tasks "
            "(id, name, description, prompt_template, analysis_mode, analysis_time_range, version, "
            "is_active, schedule_rrule, include_in_timeline, workset_id, created_at, updated_at) "
            "VALUES (?, ?, ?, '', 'recurring', 'all', 1, 1, NULL, 1, NULL, ?, ?)",
            (
                task_id,
                event.title,
                event.description or None,
                now,
                now,
            ),
        )
        await conn.execute(
            "INSERT INTO recurring_schedules "
            "(task_id, rrule, dtstart, dtend, is_all_day, location, description, timezone, timezone_ical, "
            "exdates_json, rdates_json, ics_uid, ics_source, ics_import_fingerprint, parent_task_id, "
            "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
            (
                task_id,
                event.rrule,
                event.start_local or event.start_time,
                event.end_local or event.end_time,
                1 if event.is_all_day else 0,
                event.location or None,
                event.description or None,
                event.timezone_id,
                event.timezone_ical,
                exdates_json,
                rdates_json,
                event.uid,
                source,
                event.fingerprint,
                now,
                now,
            ),
        )
        return task_id, "created"
    await conn.execute(
        "UPDATE analysis_tasks SET name = ?, description = ?, is_active = 1, version = version + 1, "
        "updated_at = ? WHERE id = ?",
        (
            event.title,
            event.description or None,
            now,
            existing_id,
        ),
    )
    await conn.execute(
        "UPDATE recurring_schedules SET rrule = ?, dtstart = ?, dtend = ?, is_all_day = ?, "
        "location = ?, description = ?, timezone = ?, timezone_ical = ?, exdates_json = ?, "
        "rdates_json = ?, ics_import_fingerprint = ?, updated_at = ? WHERE task_id = ?",
        (
            event.rrule,
            event.start_local or event.start_time,
            event.end_local or event.end_time,
            1 if event.is_all_day else 0,
            event.location or None,
            event.description or None,
            event.timezone_id,
            event.timezone_ical,
            exdates_json,
            rdates_json,
            event.fingerprint,
            now,
            existing_id,
        ),
    )
    return existing_id, "updated"

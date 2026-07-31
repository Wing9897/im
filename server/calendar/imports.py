"""ICS preview/diff and atomic UID upsert service."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from server.calendar.ics import ParsedIcsEvent, parse_ics
from server.db.database import Database
from server.util import new_id, utc_now_iso
from server.worksets_const import SYSTEM_WORKSET_ID


class CalendarImportError(ValueError):
    """Import selection is stale, ambiguous, or unsupported."""


@dataclass(frozen=True, slots=True)
class ImportSelection:
    uid: str
    fingerprint: str


def _json_list(value: Any) -> list[str]:
    if not isinstance(value, str) or not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def _existing_comparable(row: dict[str, Any], target_type: str) -> dict[str, Any]:
    if target_type == "recurring_task":
        return {
            "title": str(row.get("name") or ""),
            "description": str(row.get("event_description") or ""),
            "location": str(row.get("event_location") or ""),
            "startTime": row.get("event_start_time"),
            "endTime": row.get("event_end_time"),
            "isAllDay": bool(row.get("event_is_all_day")),
            "timezone": row.get("event_timezone"),
            "timezoneIcal": row.get("event_timezone_ical"),
            "startLocal": row.get("event_start_local"),
            "endLocal": row.get("event_end_local"),
            "rrule": row.get("rrule"),
            "exdates": _json_list(row.get("event_exdates_json")),
            "rdates": _json_list(row.get("event_rdates_json")),
        }
    return {
        "title": str(row.get("title") or ""),
        "description": str(row.get("body") or ""),
        "location": str(row.get("location") or ""),
        "startTime": row.get("start_time"),
        "endTime": row.get("end_time"),
        "isAllDay": bool(row.get("event_is_all_day")),
        "timezone": row.get("event_timezone"),
    }


def _changes(row: dict[str, Any], event: ParsedIcsEvent) -> list[dict[str, Any]]:
    before = _existing_comparable(row, event.target_type)
    after = event.comparable()
    if event.target_type == "user_event":
        after = {key: after[key] for key in before}
    return [
        {"field": key, "before": before.get(key), "after": value}
        for key, value in after.items()
        if before.get(key) != value
    ]


async def _find_existing(db: Database, source: str, uid: str) -> tuple[str, dict[str, Any]] | None:
    event = await db.fetch_one(
        "SELECT * FROM user_events WHERE ics_source = ? AND ics_uid = ?",
        (source, uid),
    )
    task = await db.fetch_one(
        "SELECT * FROM analysis_tasks WHERE ics_source = ? AND ics_uid = ?",
        (source, uid),
    )
    if event is not None and task is not None:
        raise CalendarImportError(f"UID {uid!r} is mapped to more than one target")
    if event is not None:
        return "user_event", event
    if task is not None:
        return "recurring_task", task
    return None


async def preview_calendar_import(db: Database, *, content: str, source: str) -> dict[str, Any]:
    parsed = parse_ics(content)
    items: list[dict[str, Any]] = []
    for event in parsed.events:
        existing = await _find_existing(db, source, event.uid)
        warnings = [warning.wire() for warning in event.warnings]
        supported = event.supported
        existing_id: str | None = None
        changes: list[dict[str, Any]] = []
        if existing is None:
            action = "create" if supported else "unsupported"
        else:
            existing_type, row = existing
            existing_id = str(row["id"])
            if existing_type != event.target_type:
                supported = False
                action = "unsupported"
                warnings.append(
                    {
                        "code": "target_type_changed",
                        "message": "An existing UID cannot change between a one-time event and recurring task.",
                    }
                )
            elif not supported:
                action = "unsupported"
            else:
                changes = _changes(row, event)
                action = (
                    "unchanged" if row.get("ics_import_fingerprint") == event.fingerprint and not changes else "update"
                )
        items.append(
            {
                "uid": event.uid,
                "title": event.title,
                "targetType": event.target_type,
                "action": action,
                "supported": supported,
                "existingId": existing_id,
                "fingerprint": event.fingerprint,
                "startTime": event.start_time,
                "endTime": event.end_time,
                "isAllDay": event.is_all_day,
                "timezone": event.timezone_id,
                "rrule": event.rrule,
                "exdates": list(event.exdates),
                "rdates": list(event.rdates),
                "changes": changes,
                "warnings": warnings,
            }
        )
    return {
        "sourceId": source,
        "calendarName": parsed.calendar_name,
        "eventCount": len(parsed.events),
        "importableCount": sum(1 for item in items if item["supported"]),
        "items": items,
        "warnings": [warning.wire() for warning in parsed.warnings],
    }


async def _upsert_user_event(
    conn: Any,
    *,
    event: ParsedIcsEvent,
    source: str,
    existing_id: str | None,
    now: str,
) -> tuple[str, str]:
    if existing_id is None:
        event_id = new_id()
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
    assert event.rrule is not None
    exdates_json = json.dumps(event.exdates, ensure_ascii=False, separators=(",", ":"))
    rdates_json = json.dumps(event.rdates, ensure_ascii=False, separators=(",", ":"))
    if existing_id is None:
        task_id = new_id()
        await conn.execute(
            "INSERT INTO analysis_tasks "
            "(id, name, description, prompt_template, analysis_mode, analysis_time_range, version, "
            "is_active, schedule_type, schedule_value, rrule, event_start_time, event_end_time, "
            "event_is_all_day, event_location, event_description, event_timezone, event_timezone_ical, "
            "event_start_local, "
            "event_end_local, event_exdates_json, event_rdates_json, ics_uid, ics_source, "
            "ics_import_fingerprint, include_in_timeline, parent_task_id, workset_id, created_at, updated_at) "
            "VALUES (?, ?, ?, '', 'recurring', 'all', 1, 1, 'seconds_10', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
            "?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?, ?)",
            (
                task_id,
                event.title,
                event.description or None,
                event.rrule,
                event.start_time,
                event.end_time,
                1 if event.is_all_day else 0,
                event.location or None,
                event.description or None,
                event.timezone_id,
                event.timezone_ical,
                event.start_local,
                event.end_local,
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
        "UPDATE analysis_tasks SET name = ?, description = ?, rrule = ?, event_start_time = ?, "
        "event_end_time = ?, event_is_all_day = ?, event_location = ?, event_description = ?, "
        "event_timezone = ?, event_timezone_ical = ?, event_start_local = ?, event_end_local = ?, "
        "event_exdates_json = ?, "
        "event_rdates_json = ?, ics_import_fingerprint = ?, is_active = 1, version = version + 1, "
        "updated_at = ? WHERE id = ?",
        (
            event.title,
            event.description or None,
            event.rrule,
            event.start_time,
            event.end_time,
            1 if event.is_all_day else 0,
            event.location or None,
            event.description or None,
            event.timezone_id,
            event.timezone_ical,
            event.start_local,
            event.end_local,
            exdates_json,
            rdates_json,
            event.fingerprint,
            now,
            existing_id,
        ),
    )
    return existing_id, "updated"


async def commit_calendar_import(
    db: Database,
    *,
    content: str,
    source: str,
    selections: list[ImportSelection],
) -> dict[str, Any]:
    parsed = parse_ics(content)
    by_uid: dict[str, list[ParsedIcsEvent]] = {}
    for event in parsed.events:
        by_uid.setdefault(event.uid, []).append(event)
    if not selections:
        raise CalendarImportError("At least one event must be selected")
    if len({selection.uid for selection in selections}) != len(selections):
        raise CalendarImportError("Selections contain duplicate UIDs")

    prepared: list[tuple[ParsedIcsEvent, str | None, str]] = []
    for selection in selections:
        candidates = by_uid.get(selection.uid, [])
        if not candidates:
            raise CalendarImportError(f"Selected UID {selection.uid!r} is absent from the submitted ICS")
        event = next((candidate for candidate in candidates if candidate.fingerprint == selection.fingerprint), None)
        if event is None:
            raise CalendarImportError(f"Selected UID {selection.uid!r} changed since preview")
        if not event.supported:
            raise CalendarImportError(f"Selected UID {selection.uid!r} is not importable")
        existing = await _find_existing(db, source, event.uid)
        if existing is None:
            prepared.append((event, None, "create"))
            continue
        existing_type, row = existing
        if existing_type != event.target_type:
            raise CalendarImportError(f"Selected UID {selection.uid!r} changed target type")
        if row.get("ics_import_fingerprint") == event.fingerprint and not _changes(row, event):
            prepared.append((event, str(row["id"]), "unchanged"))
        else:
            prepared.append((event, str(row["id"]), "update"))

    now = utc_now_iso()
    results: list[dict[str, Any]] = []
    async with db.transaction() as conn:
        for event, existing_id, action in prepared:
            if action == "unchanged":
                assert existing_id is not None
                target_id, result_action = existing_id, "unchanged"
            elif event.target_type == "user_event":
                target_id, result_action = await _upsert_user_event(
                    conn,
                    event=event,
                    source=source,
                    existing_id=existing_id,
                    now=now,
                )
            else:
                target_id, result_action = await _upsert_recurring_task(
                    conn,
                    event=event,
                    source=source,
                    existing_id=existing_id,
                    now=now,
                )
            results.append(
                {
                    "uid": event.uid,
                    "targetType": event.target_type,
                    "targetId": target_id,
                    "action": result_action,
                }
            )
    return {
        "sourceId": source,
        "committedCount": len(results),
        "createdCount": sum(1 for result in results if result["action"] == "created"),
        "updatedCount": sum(1 for result in results if result["action"] == "updated"),
        "unchangedCount": sum(1 for result in results if result["action"] == "unchanged"),
        "results": results,
    }

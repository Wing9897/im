"""ICS preview/diff and atomic UID upsert service."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from server.calendar.ics import ParsedIcsEvent, parse_ics
from server.calendar.imports_upsert import _upsert_recurring_task, _upsert_user_event
from server.db.database import Database
from server.util import new_id, utc_now_iso

__all__ = [
    "CalendarImportError",
    "ImportSelection",
    "commit_calendar_import",
    "new_id",
    "preview_calendar_import",
]


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
    if target_type == "recurring":
        return {
            "title": str(row.get("name") or ""),
            "description": str(row.get("event_description") or ""),
            "location": str(row.get("event_location") or ""),
            "dtstart": row.get("event_start_local"),
            "dtend": row.get("event_end_local"),
            "isAllDay": bool(row.get("event_is_all_day")),
            "timezone": row.get("event_timezone"),
            "timezoneIcal": row.get("event_timezone_ical"),
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
    if event.target_type == "recurring":
        after = {
            "title": event.title,
            "description": event.description,
            "location": event.location,
            "dtstart": event.start_local or event.start_time,
            "dtend": event.end_local or event.end_time,
            "isAllDay": event.is_all_day,
            "timezone": event.timezone_id,
            "timezoneIcal": event.timezone_ical,
            "rrule": event.rrule,
            "exdates": list(event.exdates),
            "rdates": list(event.rdates),
        }
    else:
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
    series = await db.fetch_one(
        "SELECT id, name, workset_id, is_active, rrule, "
        "dtstart AS event_start_time, dtend AS event_end_time, "
        "is_all_day AS event_is_all_day, location AS event_location, "
        "description AS event_description, timezone AS event_timezone, "
        "timezone_ical AS event_timezone_ical, dtstart AS event_start_local, "
        "dtend AS event_end_local, exdates_json AS event_exdates_json, "
        "rdates_json AS event_rdates_json, ics_import_fingerprint "
        "FROM recurring_schedules "
        "WHERE ics_source = ? AND ics_uid = ?",
        (source, uid),
    )
    if event is not None and series is not None:
        raise CalendarImportError(f"Imported event {uid!r} is mapped to more than one target")
    if event is not None:
        return "user_event", event
    if series is not None:
        return "recurring", series
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
                        "message": (
                            "An existing imported event cannot change between a one-time event and a recurring series."
                        ),
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

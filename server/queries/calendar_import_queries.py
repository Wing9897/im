"""SQL for ICS UID lookup and commit upserts."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

_IMPORT_UID_CHUNK_SIZE = 450
_RECURRING_IMPORT_SELECT_COLUMNS = (
    "id, name, workset_id, is_active, rrule, "
    "dtstart AS event_start_time, dtend AS event_end_time, "
    "is_all_day AS event_is_all_day, location AS event_location, "
    "description AS event_description, timezone AS event_timezone, "
    "timezone_ical AS event_timezone_ical, dtstart AS event_start_local, "
    "dtend AS event_end_local, exdates_json AS event_exdates_json, "
    "rdates_json AS event_rdates_json, ics_import_fingerprint, ics_uid, ics_source"
)


async def fetch_existing_import_targets_by_uids(
    db: Any,
    source_or_uids: str | Iterable[str],
    uids: Iterable[str] | None = None,
    *,
    source: str | None = None,
) -> dict[str, tuple[str, dict[str, Any]]]:
    """Batch-fetch existing imported ``user_events`` and ``recurring_schedules`` by ``ics_uid``.

    Accepts either ``fetch_existing_import_targets_by_uids(db, uids, source=...)``
    or ``fetch_existing_import_targets_by_uids(db, source, uids)``.
    Returns a map ``uid -> (target_type, row)`` where ``target_type`` is
    ``"user_event"``, ``"recurring"``, or ``"ambiguous"`` when mapped in both tables.
    """
    if isinstance(source_or_uids, str):
        resolved_source = source_or_uids
        raw_uids: Iterable[str] = uids or ()
    else:
        resolved_source = source
        raw_uids = source_or_uids

    clean_uids = list(dict.fromkeys(str(uid) for uid in raw_uids if str(uid)))
    if not clean_uids:
        return {}

    user_events_by_uid: dict[str, dict[str, Any]] = {}
    series_by_uid: dict[str, dict[str, Any]] = {}

    for start in range(0, len(clean_uids), _IMPORT_UID_CHUNK_SIZE):
        chunk = clean_uids[start : start + _IMPORT_UID_CHUNK_SIZE]
        placeholders = ",".join("?" for _ in chunk)
        if resolved_source is not None:
            where_sql = f"WHERE ics_source = ? AND ics_uid IN ({placeholders})"
            params: tuple[Any, ...] = (resolved_source, *chunk)
        else:
            where_sql = f"WHERE ics_uid IN ({placeholders})"
            params = tuple(chunk)

        event_rows = await db.fetch_all(
            f"SELECT * FROM user_events {where_sql}",
            params,
        )
        for row in event_rows:
            uid_val = str(row.get("ics_uid") or "")
            if uid_val:
                user_events_by_uid[uid_val] = row

        series_rows = await db.fetch_all(
            f"SELECT {_RECURRING_IMPORT_SELECT_COLUMNS} FROM recurring_schedules {where_sql}",
            params,
        )
        for row in series_rows:
            uid_val = str(row.get("ics_uid") or "")
            if uid_val:
                series_by_uid[uid_val] = row

    result: dict[str, tuple[str, dict[str, Any]]] = {}
    for uid_val in clean_uids:
        event_row = user_events_by_uid.get(uid_val)
        series_row = series_by_uid.get(uid_val)
        if event_row is not None and series_row is not None:
            result[uid_val] = ("ambiguous", event_row)
        elif event_row is not None:
            result[uid_val] = ("user_event", event_row)
        elif series_row is not None:
            result[uid_val] = ("recurring", series_row)
    return result


async def insert_imported_user_event(
    conn: Any,
    *,
    event_id: str,
    title: str,
    description: str,
    start_time: str,
    end_time: str | None,
    location: str,
    is_all_day: bool,
    timezone_id: str | None,
    uid: str,
    source: str,
    fingerprint: str,
    workset_id: str,
    now: str,
) -> None:
    await conn.execute(
        "INSERT INTO user_events "
        "(id, title, body, start_time, end_time, location, origin, event_is_all_day, "
        "event_timezone, ics_uid, ics_source, ics_import_fingerprint, task_id, workset_id, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ics', ?, ?, ?, ?, ?, NULL, ?, ?, ?)",
        (
            event_id,
            title,
            description,
            start_time,
            end_time,
            location,
            1 if is_all_day else 0,
            timezone_id,
            uid,
            source,
            fingerprint,
            workset_id,
            now,
            now,
        ),
    )


async def update_imported_user_event(
    conn: Any,
    *,
    event_id: str,
    title: str,
    description: str,
    start_time: str,
    end_time: str | None,
    location: str,
    is_all_day: bool,
    timezone_id: str | None,
    fingerprint: str,
    now: str,
) -> None:
    await conn.execute(
        "UPDATE user_events SET title = ?, body = ?, start_time = ?, end_time = ?, location = ?, "
        "origin = 'ics', event_is_all_day = ?, event_timezone = ?, ics_import_fingerprint = ?, "
        "updated_at = ? WHERE id = ?",
        (
            title,
            description,
            start_time,
            end_time,
            location,
            1 if is_all_day else 0,
            timezone_id,
            fingerprint,
            now,
            event_id,
        ),
    )


async def insert_imported_recurring_series(
    conn: Any,
    *,
    series_id: str,
    title: str,
    workset_id: str,
    rrule: str,
    dtstart: str,
    dtend: str | None,
    is_all_day: bool,
    location: str | None,
    description: str | None,
    timezone_id: str | None,
    timezone_ical: str | None,
    exdates_json: str,
    rdates_json: str,
    uid: str,
    source: str,
    fingerprint: str,
    now: str,
) -> None:
    await conn.execute(
        "INSERT INTO recurring_schedules "
        "(id, name, workset_id, is_active, rrule, dtstart, dtend, is_all_day, location, description, "
        "timezone, timezone_ical, exdates_json, rdates_json, ics_uid, ics_source, ics_import_fingerprint, "
        "parent_task_id, item_id, created_at, updated_at) "
        "VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)",
        (
            series_id,
            title,
            workset_id,
            rrule,
            dtstart,
            dtend,
            1 if is_all_day else 0,
            location,
            description,
            timezone_id,
            timezone_ical,
            exdates_json,
            rdates_json,
            uid,
            source,
            fingerprint,
            now,
            now,
        ),
    )


async def update_imported_recurring_series(
    conn: Any,
    *,
    series_id: str,
    title: str,
    rrule: str,
    dtstart: str,
    dtend: str | None,
    is_all_day: bool,
    location: str | None,
    description: str | None,
    timezone_id: str | None,
    timezone_ical: str | None,
    exdates_json: str,
    rdates_json: str,
    fingerprint: str,
    now: str,
) -> None:
    await conn.execute(
        "UPDATE recurring_schedules SET name = ?, is_active = 1, rrule = ?, dtstart = ?, dtend = ?, "
        "is_all_day = ?, location = ?, description = ?, timezone = ?, timezone_ical = ?, "
        "exdates_json = ?, rdates_json = ?, ics_import_fingerprint = ?, updated_at = ? WHERE id = ?",
        (
            title,
            rrule,
            dtstart,
            dtend,
            1 if is_all_day else 0,
            location,
            description,
            timezone_id,
            timezone_ical,
            exdates_json,
            rdates_json,
            fingerprint,
            now,
            series_id,
        ),
    )

"""Database queries for standalone ``recurring_schedules`` series."""

from __future__ import annotations

from typing import Any

from server.db.database import TransactionDb

#: Shared projection for calendar expand + series CRUD (single SoT).
SERIES_SELECT = """
SELECT id,
       name,
       workset_id,
       is_active,
       rrule,
       dtstart AS event_start_time,
       dtend AS event_end_time,
       COALESCE(is_all_day, 0) AS event_is_all_day,
       location AS event_location,
       description,
       description AS event_description,
       timezone AS event_timezone,
       timezone_ical AS event_timezone_ical,
       dtstart AS event_start_local,
       dtend AS event_end_local,
       COALESCE(exdates_json, '[]') AS event_exdates_json,
       COALESCE(rdates_json, '[]') AS event_rdates_json,
       ics_uid,
       ics_source,
       ics_import_fingerprint,
       parent_task_id,
       item_id,
       COALESCE(notify_pref, 'inherit') AS notify_pref,
       emoji,
       created_at,
       updated_at
FROM recurring_schedules
"""


async def fetch_series_row(db: Any, series_id: str) -> dict[str, Any] | None:
    return await db.fetch_one(f"{SERIES_SELECT} WHERE id = ?", (series_id,))


async def list_series_rows(
    db: Any,
    *,
    workset_id: str | None = None,
    item_id: str | None = None,
    parent_task_id: str | None = None,
    top_level_only: bool = False,
    search: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    clauses: list[str] = []
    params: list[Any] = []
    if workset_id is not None:
        clauses.append("workset_id = ?")
        params.append(workset_id)
    if item_id is not None:
        clauses.append("item_id = ?")
        params.append(item_id)
    if parent_task_id is not None:
        clauses.append("parent_task_id = ?")
        params.append(parent_task_id)
    if top_level_only:
        clauses.append("parent_task_id IS NULL")
    if search is not None and search.strip():
        clauses.append("(name LIKE ? OR IFNULL(location, '') LIKE ? OR IFNULL(description, '') LIKE ?)")
        needle = f"%{search.strip()}%"
        params.extend((needle, needle, needle))
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    count_row = await db.fetch_one(
        f"SELECT COUNT(*) AS n FROM recurring_schedules {where}",
        tuple(params),
    )
    total = int(count_row["n"] if count_row else 0)
    sql = f"{SERIES_SELECT} {where} ORDER BY created_at ASC, id ASC"
    if limit is not None:
        sql += " LIMIT ? OFFSET ?"
        params.extend((int(limit), max(0, int(offset))))
    rows = await db.fetch_all(sql, tuple(params))
    return rows, total


async def insert_series(
    tx: TransactionDb,
    *,
    series_id: str,
    name: str,
    workset_id: str,
    rrule: str,
    dtstart: str,
    dtend: str | None,
    is_all_day: bool,
    location: str | None,
    description: str | None,
    timezone: str,
    parent_task_id: str | None,
    item_id: str | None,
    now: str,
    is_active: bool = True,
    timezone_ical: str | None = None,
    exdates_json: str = "[]",
    rdates_json: str = "[]",
    ics_uid: str | None = None,
    ics_source: str | None = None,
    ics_import_fingerprint: str | None = None,
    notify_pref: str = "inherit",
    emoji: str | None = None,
) -> None:
    await tx.execute(
        "INSERT INTO recurring_schedules "
        "(id, name, workset_id, is_active, rrule, dtstart, dtend, is_all_day, location, description, "
        "timezone, timezone_ical, exdates_json, rdates_json, ics_uid, ics_source, ics_import_fingerprint, "
        "parent_task_id, item_id, notify_pref, emoji, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            series_id,
            name,
            workset_id,
            1 if is_active else 0,
            rrule,
            dtstart,
            dtend,
            1 if is_all_day else 0,
            location,
            description,
            timezone,
            timezone_ical,
            exdates_json,
            rdates_json,
            ics_uid,
            ics_source,
            ics_import_fingerprint,
            parent_task_id,
            item_id,
            notify_pref,
            emoji,
            now,
            now,
        ),
    )


async def delete_series(tx: TransactionDb, series_id: str) -> None:
    await tx.execute("DELETE FROM recurring_schedules WHERE id = ?", (series_id,))

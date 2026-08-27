"""Patch / hard-delete path for standalone recurring series."""

from __future__ import annotations

from types import EllipsisType
from typing import Any

from server.db.database import Database, TransactionDb
from server.domain.emoji import EmojiValidationError, emoji_from_row, normalize_optional_emoji
from server.domain.notify_prefs import DEFAULT_NOTIFY_PREF, normalize_notify_pref
from server.queries.recurring_series_queries import delete_series, fetch_series_row
from server.services.recurring_schedule_values import manual_anchor, manual_end_anchor
from server.services.task_writes import TaskWriteError, normalize_event_clock, normalize_rrule
from server.util import utc_now_iso
from server.worksets_const import SYSTEM_WORKSET_ID


async def patch_recurring_series(
    db: Database,
    *,
    series_id: str,
    name: str | None = None,
    description: Any = ...,
    rrule: str | None = None,
    event_start_time: Any = ...,
    event_end_time: Any = ...,
    event_is_all_day: bool | None = None,
    event_location: Any = ...,
    event_description: Any = ...,
    is_active: bool | None = None,
    require_parent_task_id: str | None = None,
    workset_id: str | None | EllipsisType = ...,
    notify_pref: str | None | EllipsisType = ...,
    emoji: str | None | EllipsisType = ...,
) -> dict[str, Any]:
    sid = (series_id or "").strip()
    row = await fetch_series_row(db, sid)
    if row is None:
        raise TaskWriteError(f"recurring series not found: {sid}")
    if require_parent_task_id and str(row.get("parent_task_id") or "") != str(require_parent_task_id):
        raise TaskWriteError(
            f"recurring series is outside this project scope (required parent_task_id={require_parent_task_id})"
        )

    new_name = str(row.get("name") or "") if name is None else str(name).strip()
    if not new_name:
        raise TaskWriteError("name cannot be empty")

    # Prefer series description column; event_description maps to the same field.
    if description is not ...:
        new_description = str(description).strip() if description not in (None, "") else None
    elif event_description is not ...:
        new_description = str(event_description).strip() if event_description not in (None, "") else None
    else:
        new_description = row.get("description") or row.get("event_description")

    new_rrule = normalize_rrule(rrule) if rrule is not None else str(row["rrule"])
    all_day = bool(row.get("event_is_all_day")) if event_is_all_day is None else bool(event_is_all_day)
    existing_start = str(row.get("event_start_time") or "")
    existing_end = str(row.get("event_end_time") or "")
    if event_start_time is ...:
        start_clock = None if all_day else normalize_event_clock(existing_start)
    else:
        start_clock = None if all_day else normalize_event_clock(event_start_time)
    if event_end_time is ...:
        end_clock = None if all_day else normalize_event_clock(existing_end)
    else:
        end_clock = None if all_day or event_end_time in (None, "") else normalize_event_clock(event_end_time)
    if not all_day and start_clock is None:
        raise TaskWriteError("eventStartTime is required unless eventIsAllDay is true (HH:MM or ISO)")

    if event_start_time is ... and event_is_all_day is None:
        dtstart = existing_start
    else:
        dtstart = manual_anchor(start_clock, is_all_day=all_day)
    dtend = (
        existing_end
        if event_end_time is ... and event_start_time is ... and event_is_all_day is None
        else manual_end_anchor(dtstart, end_clock, is_all_day=all_day)
    )
    location = row.get("event_location") if event_location is ... else (str(event_location).strip() or None)

    if workset_id is ...:
        resolved_workset = str(row.get("workset_id") or SYSTEM_WORKSET_ID)
    elif workset_id is None or str(workset_id).strip() == "":
        resolved_workset = SYSTEM_WORKSET_ID
    else:
        resolved_workset = str(workset_id).strip()

    if notify_pref is ...:
        resolved_notify = str(row.get("notify_pref") or DEFAULT_NOTIFY_PREF)
        try:
            resolved_notify = normalize_notify_pref(resolved_notify)
        except ValueError:
            resolved_notify = DEFAULT_NOTIFY_PREF
    else:
        try:
            resolved_notify = normalize_notify_pref(notify_pref)
        except ValueError as exc:
            raise TaskWriteError(str(exc)) from exc

    if emoji is ...:
        resolved_emoji = emoji_from_row(row)
    else:
        try:
            resolved_emoji = normalize_optional_emoji(emoji)
        except EmojiValidationError as exc:
            raise TaskWriteError(str(exc)) from exc

    now = utc_now_iso()
    active_sql = ""
    active_params: tuple[Any, ...] = ()
    if is_active is not None:
        active_sql = ", is_active = ?"
        active_params = (1 if is_active else 0,)

    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await tx.execute(
            "UPDATE recurring_schedules SET name = ?, description = ?, workset_id = ?, rrule = ?, "
            f"dtstart = ?, dtend = ?, is_all_day = ?, location = ?, notify_pref = ?, emoji = ?, "
            f"updated_at = ?{active_sql} WHERE id = ?",
            (
                new_name,
                new_description,
                resolved_workset,
                new_rrule,
                dtstart,
                dtend,
                1 if all_day else 0,
                location,
                resolved_notify,
                resolved_emoji,
                now,
                *active_params,
                sid,
            ),
        )

    updated = await fetch_series_row(db, sid)
    if updated is None:
        raise TaskWriteError("failed to update recurring series")
    from server.calendar_share.dirty import mark_published_workset_dirty

    prev_workset = str(row.get("workset_id") or SYSTEM_WORKSET_ID)
    await mark_published_workset_dirty(db, prev_workset, resolved_workset)
    return updated


async def hard_delete_recurring_series(
    db: Database,
    *,
    series_id: str,
    require_parent_task_id: str | None = None,
) -> dict[str, Any]:
    """Hard-delete the series row (not soft pause)."""
    sid = (series_id or "").strip()
    row = await fetch_series_row(db, sid)
    if row is None:
        raise TaskWriteError(f"recurring series not found: {sid}")
    if require_parent_task_id and str(row.get("parent_task_id") or "") != str(require_parent_task_id):
        raise TaskWriteError(
            f"recurring series is outside this project scope (required parent_task_id={require_parent_task_id})"
        )
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        occurrence_pattern = f"{sid}:%"
        await tx.execute(
            "DELETE FROM timeline_dismissals WHERE source = 'recurring' AND event_id LIKE ?",
            (occurrence_pattern,),
        )
        await tx.execute(
            "DELETE FROM timeline_importance WHERE source = 'recurring' AND event_id LIKE ?",
            (occurrence_pattern,),
        )
        await delete_series(tx, sid)
    from server.calendar_share.dirty import mark_published_workset_dirty

    await mark_published_workset_dirty(db, str(row.get("workset_id") or SYSTEM_WORKSET_ID))
    return row

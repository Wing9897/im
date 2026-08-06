"""Schedule subresource writes (parent-link + upsert/delete schedule row)."""

from __future__ import annotations

from types import EllipsisType
from typing import Any

from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import CHILD_RECURRING_MODE
from server.queries.tasks_queries import fetch_task_row
from server.services.recurring_schedule_values import manual_anchor, manual_end_anchor
from server.services.recurring_task_patch import patch_recurring_task
from server.services.task_writes import (
    TaskWriteError,
    assert_parent_project_row,
    normalize_event_clock,
    normalize_rrule,
    resolve_parent_task_id,
)
from server.util import utc_now_iso


async def upsert_task_schedule(
    db: Database,
    *,
    task_id: str,
    rrule: str,
    event_start_time: str | None,
    event_end_time: str | None = None,
    event_is_all_day: bool = False,
    event_location: str | None = None,
    event_description: str | None = None,
    parent_task_id: str | None | EllipsisType = ...,
) -> dict[str, Any]:
    """Create or replace the ``recurring_schedules`` row for a recurring task."""
    tid = (task_id or "").strip()
    row = await fetch_task_row(db, tid)
    if row is None:
        raise TaskWriteError(f"task not found: {tid}")
    if str(row.get("analysis_mode") or "") != CHILD_RECURRING_MODE:
        raise TaskWriteError("schedule subresource requires analysisMode=recurring")

    if row.get("rrule"):
        return await patch_recurring_task(
            db,
            task_id=tid,
            rrule=rrule,
            event_start_time=event_start_time,
            event_end_time=event_end_time,
            event_is_all_day=event_is_all_day,
            event_location=event_location if event_location is not None else ...,
            event_description=event_description if event_description is not None else ...,
            require_parent_task_id=None if parent_task_id is ... else parent_task_id,
        )

    rrule_text = normalize_rrule(rrule)
    is_all_day = bool(event_is_all_day)
    start_clock = None if is_all_day else normalize_event_clock(event_start_time)
    end_clock = None if is_all_day else normalize_event_clock(event_end_time)
    if not is_all_day and start_clock is None:
        raise TaskWriteError("eventStartTime is required unless eventIsAllDay is true (HH:MM or ISO)")

    parent: str | None = None
    if parent_task_id is not ... and parent_task_id:
        parent = await assert_parent_project_row(db, str(parent_task_id).strip())
        parent = resolve_parent_task_id(
            task_id=tid,
            effective_mode=CHILD_RECURRING_MODE,
            supplied_parent_task_id=parent,
            parent_mode="agent",
        )
    elif row.get("parent_task_id"):
        parent = str(row["parent_task_id"])

    dtstart = manual_anchor(start_clock, is_all_day=is_all_day)
    dtend = manual_end_anchor(dtstart, end_clock, is_all_day=is_all_day)
    now = utc_now_iso()
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await tx.execute(
            "INSERT INTO recurring_schedules "
            "(task_id, rrule, dtstart, dtend, is_all_day, location, description, timezone, "
            "parent_task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'floating', ?, ?, ?)",
            (
                tid,
                rrule_text,
                dtstart,
                dtend,
                1 if is_all_day else 0,
                str(event_location).strip() if event_location else None,
                str(event_description).strip() if event_description else None,
                parent,
                now,
                now,
            ),
        )
        if parent is not None:
            await tx.execute(
                "UPDATE recurring_schedules SET parent_task_id = ?, updated_at = ? WHERE task_id = ?",
                (parent, now, tid),
            )
    updated = await fetch_task_row(db, tid)
    if updated is None or not updated.get("rrule"):
        raise TaskWriteError("failed to create task schedule")
    return updated


async def delete_task_schedule(db: Database, *, task_id: str) -> bool:
    """Remove the schedule row; the recurring task shell remains."""
    tid = (task_id or "").strip()
    row = await fetch_task_row(db, tid)
    if row is None:
        raise TaskWriteError(f"task not found: {tid}")
    if str(row.get("analysis_mode") or "") != CHILD_RECURRING_MODE:
        raise TaskWriteError("schedule subresource requires analysisMode=recurring")
    if not row.get("rrule"):
        return False
    await db.execute("DELETE FROM recurring_schedules WHERE task_id = ?", (tid,))
    return True

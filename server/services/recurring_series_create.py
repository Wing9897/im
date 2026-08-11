"""Create path for standalone ``recurring_schedules`` series."""

from __future__ import annotations

from types import EllipsisType
from typing import Any

from server.db.database import Database, TransactionDb
from server.queries.recurring_series_queries import fetch_series_row, insert_series
from server.services.recurring_schedule_values import manual_anchor, manual_end_anchor
from server.services.task_writes import (
    TaskWriteError,
    assert_parent_agent_row,
    normalize_event_clock,
    normalize_rrule,
    resolve_series_parent_task_id,
)
from server.util import new_id, utc_now_iso
from server.worksets_const import SYSTEM_WORKSET_ID


async def create_recurring_series(
    db: Database,
    *,
    name: str,
    rrule: str,
    event_start_time: str | None,
    event_end_time: str | None = None,
    event_is_all_day: bool = False,
    event_location: str | None = None,
    event_description: str | None = None,
    parent_task_id: str | None = None,
    description: str | None = None,
    workset_id: str | None | EllipsisType = ...,
    item_id: str | None = None,
) -> dict[str, Any]:
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise TaskWriteError("name is required")

    rrule_text = normalize_rrule(rrule)
    is_all_day = bool(event_is_all_day)
    start_clock = None if is_all_day else normalize_event_clock(event_start_time)
    end_clock = None if is_all_day else normalize_event_clock(event_end_time)
    if not is_all_day and start_clock is None:
        raise TaskWriteError("eventStartTime is required unless eventIsAllDay is true (HH:MM or ISO)")

    parent: str | None = None
    parent_row: dict[str, Any] | None = None
    if parent_task_id:
        parent = await assert_parent_agent_row(db, str(parent_task_id).strip())
        parent = resolve_series_parent_task_id(
            series_id=None,
            supplied_parent_task_id=parent,
            parent_mode="agent",
        )
        parent_row = await db.fetch_one("SELECT workset_id FROM analysis_tasks WHERE id = ?", (parent,))

    if workset_id is ...:
        if parent_row and parent_row.get("workset_id"):
            resolved_workset = str(parent_row["workset_id"])
        else:
            resolved_workset = SYSTEM_WORKSET_ID
    elif workset_id is None or str(workset_id).strip() == "":
        resolved_workset = SYSTEM_WORKSET_ID
    else:
        resolved_workset = str(workset_id).strip()

    series_id = new_id()
    now = utc_now_iso()
    dtstart = manual_anchor(start_clock, is_all_day=is_all_day)
    dtend = manual_end_anchor(dtstart, end_clock, is_all_day=is_all_day)
    desc = (
        str(event_description).strip()
        if event_description not in (None, "")
        else (str(description).strip() if description not in (None, "") else None)
    )

    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await insert_series(
            tx,
            series_id=series_id,
            name=cleaned_name,
            workset_id=resolved_workset,
            rrule=rrule_text,
            dtstart=dtstart,
            dtend=dtend,
            is_all_day=is_all_day,
            location=str(event_location).strip() if event_location else None,
            description=desc,
            timezone="floating",
            parent_task_id=parent,
            item_id=str(item_id).strip() if item_id else None,
            now=now,
        )

    row = await fetch_series_row(db, series_id)
    if row is None:
        raise TaskWriteError("failed to create recurring series")
    return row

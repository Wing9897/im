"""Create path for recurring tasks + ``recurring_schedules`` row."""

from __future__ import annotations

from types import EllipsisType
from typing import Any

from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import CHILD_RECURRING_MODE
from server.queries.tasks_queries import fetch_task_row, insert_analysis_task
from server.services.recurring_schedule_values import manual_anchor, manual_end_anchor
from server.services.task_writes import (
    TaskWriteError,
    assert_parent_project_row,
    normalize_event_clock,
    normalize_rrule,
    resolve_parent_task_id,
)
from server.util import new_id, utc_now_iso


async def create_recurring_task(
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
        parent = await assert_parent_project_row(db, str(parent_task_id).strip())
        parent = resolve_parent_task_id(
            task_id=None,
            effective_mode=CHILD_RECURRING_MODE,
            supplied_parent_task_id=parent,
            parent_mode="agent",
        )
        parent_row = await db.fetch_one("SELECT workset_id FROM analysis_tasks WHERE id = ?", (parent,))

    resolved_workset = (
        str(parent_row["workset_id"])
        if workset_id is ... and parent_row and parent_row.get("workset_id")
        else (None if workset_id is ... else (str(workset_id).strip() if workset_id else None))
    )
    task_id = new_id()
    now = utc_now_iso()
    dtstart = manual_anchor(start_clock, is_all_day=is_all_day)
    dtend = manual_end_anchor(dtstart, end_clock, is_all_day=is_all_day)

    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await insert_analysis_task(
            tx,
            task_id=task_id,
            name=cleaned_name,
            description=description,
            prompt_template="",
            analysis_mode=CHILD_RECURRING_MODE,
            analysis_time_range="all",
            schedule_rrule=None,
            workset_id=resolved_workset,
            now=now,
        )
        await tx.execute(
            "INSERT INTO recurring_schedules "
            "(task_id, rrule, dtstart, dtend, is_all_day, location, description, timezone, "
            "parent_task_id, item_id, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'floating', ?, ?, ?, ?)",
            (
                task_id,
                rrule_text,
                dtstart,
                dtend,
                1 if is_all_day else 0,
                str(event_location).strip() if event_location else None,
                str(event_description).strip() if event_description else None,
                parent,
                str(item_id).strip() if item_id else None,
                now,
                now,
            ),
        )

    row = await fetch_task_row(db, task_id)
    if row is None:
        raise TaskWriteError("failed to create recurring task")
    return row

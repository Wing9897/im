"""Shared writes for recurring tasks and their ``recurring_schedules`` row."""

from __future__ import annotations

from datetime import datetime, timedelta
from types import EllipsisType
from typing import Any

from server.calendar.occurrence_span import roll_end_if_overnight
from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import CHILD_RECURRING_MODE
from server.queries.tasks_queries import (
    fetch_task_row,
    insert_analysis_task,
    set_task_active,
    update_analysis_task,
)
from server.services.task_writes import (
    TaskWriteError,
    assert_parent_project_row,
    normalize_event_clock,
    normalize_rrule,
    resolve_parent_task_id,
)
from server.util import new_id, utc_now_iso


def _manual_anchor(clock: str | None, *, is_all_day: bool) -> str:
    local_now = datetime.now().astimezone()
    if is_all_day:
        return local_now.date().isoformat()
    assert clock is not None
    hour, minute = (int(part) for part in clock.split(":", 1))
    return local_now.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=None).isoformat()


def _manual_end_anchor(dtstart: str, end_clock: str | None, *, is_all_day: bool) -> str | None:
    """Build dtend; overnight clocks share ``roll_end_if_overnight`` with expand."""
    if is_all_day:
        return (datetime.fromisoformat(dtstart) + timedelta(days=1)).date().isoformat()
    if end_clock is None:
        return None
    start = datetime.fromisoformat(dtstart)
    hour, minute = (int(part) for part in end_clock.split(":", 1))
    end = roll_end_if_overnight(start, start.replace(hour=hour, minute=minute))
    return end.isoformat()


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
            parent_mode="project",
        )
        parent_row = await db.fetch_one("SELECT workset_id FROM analysis_tasks WHERE id = ?", (parent,))

    resolved_workset = (
        str(parent_row["workset_id"])
        if workset_id is ... and parent_row and parent_row.get("workset_id")
        else (None if workset_id is ... else (str(workset_id).strip() if workset_id else None))
    )
    task_id = new_id()
    now = utc_now_iso()
    dtstart = _manual_anchor(start_clock, is_all_day=is_all_day)
    dtend = _manual_end_anchor(dtstart, end_clock, is_all_day=is_all_day)

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
            "parent_task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'floating', ?, ?, ?)",
            (
                task_id,
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

    row = await fetch_task_row(db, task_id)
    if row is None:
        raise TaskWriteError("failed to create recurring task")
    return row


async def patch_recurring_task(
    db: Database,
    *,
    task_id: str,
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
) -> dict[str, Any]:
    tid = (task_id or "").strip()
    row = await fetch_task_row(db, tid)
    if row is None:
        raise TaskWriteError(f"recurring task not found: {tid}")
    if str(row.get("analysis_mode") or "") != CHILD_RECURRING_MODE:
        raise TaskWriteError(
            "task is not analysisMode=recurring; update_recurring_task / delete_recurring_task refuse other modes"
        )
    if require_parent_task_id and str(row.get("parent_task_id") or "") != str(require_parent_task_id):
        raise TaskWriteError(
            f"recurring task is outside this project scope (required parent_task_id={require_parent_task_id})"
        )

    new_name = str(row.get("name") or "") if name is None else str(name).strip()
    if not new_name:
        raise TaskWriteError("name cannot be empty")
    new_description = (
        row.get("description")
        if description is ...
        else (str(description).strip() if description not in (None, "") else None)
    )
    has_schedule = bool(row.get("rrule"))
    schedule_touch = any(
        (
            rrule is not None,
            event_start_time is not ...,
            event_end_time is not ...,
            event_is_all_day is not None,
            event_location is not ...,
            event_description is not ...,
        )
    )
    if schedule_touch and not has_schedule and rrule is None:
        raise TaskWriteError("task schedule is missing; PUT /tasks/{id}/schedule first")

    now = utc_now_iso()
    new_version = int(row.get("version") or 1) + 1
    new_rrule = None
    dtstart = None
    dtend = None
    all_day = bool(row.get("event_is_all_day"))
    location = row.get("event_location")
    event_desc = row.get("event_description")

    if has_schedule or rrule is not None:
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
            dtstart = _manual_anchor(start_clock, is_all_day=all_day)
        dtend = (
            existing_end
            if event_end_time is ... and event_start_time is ... and event_is_all_day is None
            else _manual_end_anchor(dtstart, end_clock, is_all_day=all_day)
        )
        location = row.get("event_location") if event_location is ... else (str(event_location).strip() or None)
        event_desc = (
            row.get("event_description") if event_description is ... else (str(event_description).strip() or None)
        )

    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await update_analysis_task(
            tx,
            task_id=tid,
            name=new_name,
            description=new_description,
            prompt_template="",
            analysis_mode=CHILD_RECURRING_MODE,
            analysis_time_range=str(row.get("analysis_time_range") or "all"),
            version=new_version,
            schedule_rrule=row.get("schedule_rrule"),
            include_in_timeline=1,
            workset_id=(
                (str(workset_id).strip() if workset_id else None)
                if workset_id is not ...
                else (row.get("workset_id") or None)
            ),
            project_wave_interval_seconds=None,
            batch_overlap_count=None,
            analysis_trigger_threshold=row.get("analysis_trigger_threshold"),
            analysis_batch_message_limit=row.get("analysis_batch_message_limit"),
            analysis_strategy_mode=row.get("analysis_strategy_mode"),
            now=now,
        )
        if new_rrule is not None:
            await tx.execute(
                "UPDATE recurring_schedules SET rrule = ?, dtstart = ?, dtend = ?, is_all_day = ?, "
                "location = ?, description = ?, updated_at = ? WHERE task_id = ?",
                (new_rrule, dtstart, dtend, 1 if all_day else 0, location, event_desc, now, tid),
            )

    if is_active is not None:
        await set_task_active(db, tid, 1 if is_active else 0, now)
    updated = await fetch_task_row(db, tid)
    if updated is None:
        raise TaskWriteError("failed to update recurring task")
    return updated


async def create_recurring_task_shell(
    db: Database,
    *,
    name: str,
    description: str | None = None,
    workset_id: str | None = None,
) -> dict[str, Any]:
    """Deprecated: prefer ``create_recurring_task`` / ``POST /tasks/recurring``.

    Creates a recurring ``analysis_tasks`` row without a schedule (caller must
    ``PUT /tasks/{id}/schedule``). Kept for ``POST /tasks`` + ``analysisMode=recurring``
    compatibility and existing contract tests — do not use for new web/timeline creates.
    """
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise TaskWriteError("name is required")
    task_id = new_id()
    now = utc_now_iso()
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
            include_in_timeline=1,
            workset_id=workset_id,
            now=now,
        )
    row = await fetch_task_row(db, task_id)
    if row is None:
        raise TaskWriteError("failed to create recurring task")
    return row


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
            parent_mode="project",
        )
    elif row.get("parent_task_id"):
        parent = str(row["parent_task_id"])

    dtstart = _manual_anchor(start_clock, is_all_day=is_all_day)
    dtend = _manual_end_anchor(dtstart, end_clock, is_all_day=is_all_day)
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


async def soft_delete_recurring_task(
    db: Database,
    *,
    task_id: str,
    require_parent_task_id: str | None = None,
) -> dict[str, Any]:
    tid = (task_id or "").strip()
    row = await fetch_task_row(db, tid)
    if row is None:
        raise TaskWriteError(f"recurring task not found: {tid}")
    if str(row.get("analysis_mode") or "") != CHILD_RECURRING_MODE or not row.get("rrule"):
        raise TaskWriteError(
            "task is not analysisMode=recurring; update_recurring_task / delete_recurring_task refuse other modes"
        )
    if require_parent_task_id and str(row.get("parent_task_id") or "") != str(require_parent_task_id):
        raise TaskWriteError(
            f"recurring task is outside this project scope (required parent_task_id={require_parent_task_id})"
        )
    await set_task_active(db, tid, 0, utc_now_iso())
    updated = await fetch_task_row(db, tid)
    if updated is None:
        raise TaskWriteError("failed to deactivate recurring task")
    return updated

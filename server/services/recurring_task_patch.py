"""Patch / soft-delete path for recurring tasks."""

from __future__ import annotations

from types import EllipsisType
from typing import Any

from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import CHILD_RECURRING_MODE
from server.queries.tasks_queries import fetch_task_row, set_task_active, update_analysis_task
from server.services.recurring_schedule_values import manual_anchor, manual_end_anchor
from server.services.task_writes import TaskWriteError, normalize_event_clock, normalize_rrule
from server.util import utc_now_iso


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
            dtstart = manual_anchor(start_clock, is_all_day=all_day)
        dtend = (
            existing_end
            if event_end_time is ... and event_start_time is ... and event_is_all_day is None
            else manual_end_anchor(dtstart, end_clock, is_all_day=all_day)
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
            agent_wave_interval_seconds=None,
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

"""Shared create/patch for ``analysis_mode=recurring`` tasks.

REST and agent calendar tools both call these helpers so RRULE / clock /
``parent_task_id`` invariants live in one place. Agent handlers only inject
ownership gates (``_parent_task_id`` / ``_require_parent_task_id``).
"""

from __future__ import annotations

from typing import Any

from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import CHILD_RECURRING_MODE
from server.queries.tasks_queries import (
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
    workset_id: str | None = ...,
) -> dict[str, Any]:
    """Insert a recurring-mode task; return the fresh row dict."""
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

    resolved_workset: str | None
    if workset_id is ...:
        resolved_workset = str(parent_row["workset_id"]) if parent_row and parent_row.get("workset_id") else None
    else:
        resolved_workset = str(workset_id).strip() if workset_id else None

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
            schedule_type="seconds_10",
            schedule_value=None,
            rrule=rrule_text,
            event_start_time=start_clock,
            event_end_time=end_clock,
            event_is_all_day=1 if is_all_day else 0,
            event_location=str(event_location).strip() if event_location else None,
            event_description=str(event_description).strip() if event_description else None,
            parent_task_id=parent,
            workset_id=resolved_workset,
            now=now,
        )

    row = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))
    if row is None:
        raise TaskWriteError("failed to create recurring task")
    return dict(row)


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
    workset_id: str | None = ...,
) -> dict[str, Any]:
    """Patch an existing recurring-mode task; return the updated row dict."""
    tid = (task_id or "").strip()
    if not tid:
        raise TaskWriteError("id is required")

    row = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (tid,))
    if row is None:
        raise TaskWriteError(f"recurring task not found: {tid}")
    if str(row.get("analysis_mode") or "") != CHILD_RECURRING_MODE:
        raise TaskWriteError(
            "task is not analysisMode=recurring; update_recurring_task / delete_recurring_task refuse other modes"
        )
    if require_parent_task_id:
        parent = row.get("parent_task_id")
        if str(parent or "") != str(require_parent_task_id):
            raise TaskWriteError(
                f"recurring task is outside this project scope (required parent_task_id={require_parent_task_id})"
            )

    new_name = str(row.get("name") or "")
    if name is not None:
        new_name = str(name).strip()
        if not new_name:
            raise TaskWriteError("name cannot be empty")

    if description is not ...:
        new_description = str(description).strip() if description not in (None, "") else None
    else:
        new_description = row.get("description")

    if rrule is not None:
        new_rrule = normalize_rrule(rrule)
    else:
        new_rrule = str(row.get("rrule") or "").strip() or None
        if not new_rrule:
            raise TaskWriteError("existing recurring task has empty rrule; supply rrule")

    if event_is_all_day is not None:
        is_all_day = bool(event_is_all_day)
    else:
        is_all_day = bool(row.get("event_is_all_day"))

    if event_start_time is not ...:
        start_clock = normalize_event_clock(event_start_time)
    else:
        start_clock = normalize_event_clock(row.get("event_start_time"))

    if event_end_time is not ...:
        end_clock = None if event_end_time in (None, "") else normalize_event_clock(event_end_time)
    else:
        end_clock = normalize_event_clock(row.get("event_end_time"))

    if is_all_day:
        start_clock = None
        end_clock = None
    elif start_clock is None:
        raise TaskWriteError("eventStartTime is required unless eventIsAllDay is true (HH:MM or ISO)")

    if event_location is not ...:
        new_location = str(event_location).strip() if event_location not in (None, "") else None
    else:
        new_location = row.get("event_location")

    if event_description is not ...:
        new_event_description = str(event_description).strip() if event_description not in (None, "") else None
    else:
        new_event_description = row.get("event_description")

    # Keep existing parent; mode stays recurring so it is never cleared here.
    parent = resolve_parent_task_id(
        task_id=tid,
        effective_mode=CHILD_RECURRING_MODE,
        supplied_parent_task_id=None,
        existing_parent_task_id=row.get("parent_task_id"),
    )

    now = utc_now_iso()
    new_version = int(row.get("version") or 1) + 1
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
            schedule_type=str(row.get("schedule_type") or "seconds_10"),
            schedule_value=row.get("schedule_value"),
            rrule=new_rrule,
            event_start_time=start_clock,
            event_end_time=end_clock,
            event_is_all_day=1 if is_all_day else 0,
            event_location=str(new_location).strip() if new_location else None,
            event_description=str(new_event_description).strip() if new_event_description else None,
            include_in_timeline=1,
            parent_task_id=parent,
            workset_id=(
                (str(workset_id).strip() if workset_id else None)
                if workset_id is not ...
                else (row.get("workset_id") or None)
            ),
            # Recurring children never own project/event scheduling knobs.
            project_wave_interval_seconds=None,
            batch_overlap_count=None,
            analysis_trigger_threshold=row.get("analysis_trigger_threshold"),
            analysis_batch_message_limit=row.get("analysis_batch_message_limit"),
            analysis_strategy_mode=row.get("analysis_strategy_mode"),
            now=now,
        )

    if is_active is not None:
        await set_task_active(db, tid, 1 if is_active else 0, now)

    updated = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (tid,))
    if updated is None:
        raise TaskWriteError("failed to update recurring task")
    return dict(updated)


async def soft_delete_recurring_task(
    db: Database,
    *,
    task_id: str,
    require_parent_task_id: str | None = None,
) -> dict[str, Any]:
    """Soft-delete (``isActive=false``) a recurring task without a version bump."""
    tid = (task_id or "").strip()
    if not tid:
        raise TaskWriteError("id is required")

    row = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (tid,))
    if row is None:
        raise TaskWriteError(f"recurring task not found: {tid}")
    if str(row.get("analysis_mode") or "") != CHILD_RECURRING_MODE:
        raise TaskWriteError(
            "task is not analysisMode=recurring; update_recurring_task / delete_recurring_task refuse other modes"
        )
    if require_parent_task_id:
        parent = row.get("parent_task_id")
        if str(parent or "") != str(require_parent_task_id):
            raise TaskWriteError(
                f"recurring task is outside this project scope (required parent_task_id={require_parent_task_id})"
            )

    now = utc_now_iso()
    await set_task_active(db, tid, 0, now)
    updated = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (tid,))
    if updated is None:
        raise TaskWriteError("failed to deactivate recurring task")
    return dict(updated)

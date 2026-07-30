"""Tasks routes: CRUD with version-bump invalidation, presets, activity spans.

Fixed-path routes (templates / activity-spans) are registered before the
``/{task_id}`` routes so they are never captured as ids. The chat-assistant
endpoint lives in ``server/api/routes/task_assistant.py``.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Query, Request

from server.api.channel_refs import parse_channel_refs
from server.api.deps import (
    API_DEPS,
    get_db,
    get_scheduler,
    publish_resource_modified,
)
from server.api.routes.task_helpers import (
    ALLOWED_MODES,
    TaskConfigBody,
    channel_refs_for,
    get_task_row,
    resolve_workset_id,
    schedule_override_write_fields,
    task_response,
    validate_task_body,
    validate_task_rrule,
)
from server.api.routes.task_preset_data import BUILTIN_PRESETS
from server.api.schemas.responses import (
    ProjectTickStatusResponse,
    TaskActivitySpanResponse,
    TaskDeleteResponse,
    TaskResponse,
)
from server.db.database import TransactionDb
from server.domain.analysis_modes import (
    CALENDAR_TASK_MODE,
    CHILD_RECURRING_MODE,
    LEADERBOARD_MODE,
    PARENT_PROJECT_MODE,
)
from server.errors import VALIDATION_ERROR, http_error
from server.queries.batch_housekeeping import purge_superseded_task_version_data
from server.queries.project_tick_queries import (
    count_project_messages_since_cursor,
    fetch_project_tick_in_flight_row,
    fetch_project_tick_log_rows,
    load_project_message_cursor,
)
from server.queries.tasks_queries import (
    delete_analysis_task,
    delete_incomplete_batches,
    fetch_activity_span_rows,
    fetch_all_task_channel_rows,
    fetch_all_task_rows,
    fetch_task_channel_rows,
    insert_analysis_task,
    replace_task_channels,
    set_task_active,
    update_analysis_task,
)
from server.services.recurring_task_writes import (
    create_recurring_task,
    patch_recurring_task,
)
from server.services.task_writes import (
    TaskWriteError,
    calendar_task_write_fields,
    clear_children_parent_links,
    resolve_include_in_timeline,
    resolve_parent_task_id,
    should_reset_project_message_cursor,
)
from server.util import new_id, utc_now_iso
from server.wire.serializers import (
    serialize_activity_span,
    serialize_channel_ref,
    serialize_project_tick_in_flight,
    serialize_project_tick_log_entry,
    serialize_task,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"], dependencies=API_DEPS)


def _notify(request: Request, task_id: str, action: str) -> None:
    publish_resource_modified(request, "task", task_id, action)


# ── fixed-path routes (must precede /{task_id}) ──────────────────────────


@router.get("/templates")
async def list_templates() -> list[dict]:
    return BUILTIN_PRESETS


@router.get("/activity-spans", response_model=list[TaskActivitySpanResponse])
async def activity_spans(request: Request) -> list[dict]:
    db = get_db(request)
    rows = await fetch_activity_span_rows(db)
    return [serialize_activity_span(row) for row in rows]


@router.get("/{task_id}/project-ticks", response_model=ProjectTickStatusResponse)
async def project_tick_status(
    request: Request,
    task_id: str,
    limit: int = Query(20, ge=1, le=50),
) -> dict[str, Any]:
    """Cursor backlog + recent project-tick success/skip/error log."""
    db = get_db(request)
    row = await get_task_row(db, task_id)
    if row is None:
        raise http_error(404, "Task not found")
    if str(row.get("analysis_mode") or "") != PARENT_PROJECT_MODE:
        raise http_error(422, "Task is not analysis_mode=project", error_code=VALIDATION_ERROR)
    cursor = await load_project_message_cursor(db, task_id)
    pending = await count_project_messages_since_cursor(db, task_id)
    ticks = await fetch_project_tick_log_rows(db, task_id=task_id, limit=limit)
    in_flight = await fetch_project_tick_in_flight_row(db, task_id=task_id)
    return {
        "taskId": task_id,
        "cursorAt": cursor.timestamp if cursor else None,
        "pendingSinceCursor": pending,
        "ticks": [serialize_project_tick_log_entry(item) for item in ticks],
        "inFlight": serialize_project_tick_in_flight(in_flight) if in_flight else None,
    }


# ── CRUD ─────────────────────────────────────────────────────────────────


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    request: Request,
    top_level_only: bool = Query(False),
    analysis_mode: Optional[str] = Query(None),
    workset_id: Optional[str] = Query(None),
) -> list[dict]:
    db = get_db(request)
    rows = await fetch_all_task_rows(db)
    if top_level_only:
        rows = [row for row in rows if not row.get("parent_task_id")]
    if analysis_mode is not None:
        mode = analysis_mode.strip()
        if mode not in ALLOWED_MODES:
            raise http_error(
                422,
                f"Invalid analysis_mode: {analysis_mode}",
                error_code=VALIDATION_ERROR,
            )
        rows = [row for row in rows if str(row.get("analysis_mode") or "") == mode]
    if workset_id is not None:
        wid = workset_id.strip()
        if not wid:
            rows = [row for row in rows if not row.get("workset_id")]
        else:
            rows = [row for row in rows if str(row.get("workset_id") or "") == wid]
    links = await fetch_all_task_channel_rows(db)
    by_task: dict[str, list[dict[str, Any]]] = {}
    for link in links:
        by_task.setdefault(str(link["task_id"]), []).append(serialize_channel_ref(link))
    return [serialize_task(row, by_task.get(str(row["id"]), [])) for row in rows]


@router.post("", status_code=201, response_model=TaskResponse)
async def create_task(request: Request, body: TaskConfigBody) -> dict:
    validate_task_body(body)
    effective_mode = body.analysisMode or LEADERBOARD_MODE
    db = get_db(request)

    # Recurring creates share RRULE / clock rules with the agent tools.
    if effective_mode == CHILD_RECURRING_MODE:
        try:
            row = await create_recurring_task(
                db,
                name=body.name.strip(),
                rrule=body.rrule if body.rrule is not None else "",
                event_start_time=body.eventStartTime,
                event_end_time=body.eventEndTime,
                event_is_all_day=bool(body.eventIsAllDay),
                event_location=body.eventLocation,
                event_description=body.eventDescription,
                description=body.description,
                workset_id=await resolve_workset_id(db, supplied=body.worksetId),
            )
        except TaskWriteError as exc:
            raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
        task_id = str(row["id"])
        if body.isActive is not None and not body.isActive:
            await set_task_active(db, task_id, 0, utc_now_iso())
        scheduler = get_scheduler(request)
        if scheduler is not None:
            await scheduler.register_task(task_id)
        _notify(request, task_id, "created")
        row = await get_task_row(db, task_id)
        return task_response(row, await channel_refs_for(db, task_id), deleted=0)

    rrule = validate_task_rrule(effective_mode=effective_mode, supplied_rrule=body.rrule)

    task_id = new_id()
    now = utc_now_iso()
    # calendar_task is a filter bucket: ignore channels (same as recurring UX).
    refs = [] if effective_mode == CALENDAR_TASK_MODE else parse_channel_refs(body.channelIds)
    write_fields = calendar_task_write_fields(
        effective_mode=effective_mode,
        prompt_template=body.promptTemplate,
        rrule=rrule,
        event_start_time=body.eventStartTime,
        event_end_time=body.eventEndTime,
        event_is_all_day=body.eventIsAllDay,
        event_location=body.eventLocation,
        event_description=body.eventDescription,
    )
    include_in_timeline = resolve_include_in_timeline(
        effective_mode=effective_mode,
        supplied=body.includeInTimeline,
    )
    try:
        parent_task_id = resolve_parent_task_id(
            task_id=None,
            effective_mode=effective_mode,
            supplied_parent_task_id=None,
        )
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    workset_id = await resolve_workset_id(db, supplied=body.worksetId)
    # Row + channel links commit together: a task without its channels would be
    # scheduled but analyse nothing.
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await insert_analysis_task(
            tx,
            task_id=task_id,
            name=body.name.strip(),
            description=body.description,
            analysis_mode=effective_mode,
            analysis_time_range=body.analysisTimeRange or "all",
            schedule_type=body.scheduleType or ("hourly" if effective_mode == "project" else "seconds_10"),
            schedule_value=body.scheduleValue,
            include_in_timeline=include_in_timeline,
            parent_task_id=parent_task_id,
            workset_id=workset_id,
            now=now,
            **write_fields,
            **schedule_override_write_fields(body),
        )
        await replace_task_channels(tx, task_id, refs)

    # Scheduler registration and SSE notification are external side effects:
    # they must only run after the write is durably committed.
    scheduler = get_scheduler(request)
    if scheduler is not None:
        await scheduler.register_task(task_id)

    _notify(request, task_id, "created")
    row = await get_task_row(db, task_id)
    return task_response(row, await channel_refs_for(db, task_id), deleted=0)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(request: Request, task_id: str, body: TaskConfigBody) -> dict:
    validate_task_body(body)
    db = get_db(request)
    existing = await get_task_row(db, task_id)
    existing_mode = str(existing.get("analysis_mode") or "")
    effective_mode = body.analysisMode or existing_mode or LEADERBOARD_MODE

    # Recurring patches share RRULE / clock rules with the agent tools.
    if effective_mode == CHILD_RECURRING_MODE and existing_mode == CHILD_RECURRING_MODE:
        fields_set = body.model_fields_set
        try:
            workset_id = await resolve_workset_id(
                db,
                supplied=body.worksetId,
                existing=existing.get("workset_id"),
                fields_set=fields_set,
            )
            await patch_recurring_task(
                db,
                task_id=task_id,
                name=body.name.strip(),
                description=(body.description if "description" in fields_set else ...),
                rrule=body.rrule if "rrule" in fields_set else None,
                event_start_time=(body.eventStartTime if "eventStartTime" in fields_set else ...),
                event_end_time=(body.eventEndTime if "eventEndTime" in fields_set else ...),
                event_is_all_day=(body.eventIsAllDay if "eventIsAllDay" in fields_set else None),
                event_location=(body.eventLocation if "eventLocation" in fields_set else ...),
                event_description=(body.eventDescription if "eventDescription" in fields_set else ...),
                is_active=body.isActive if "isActive" in fields_set else None,
                workset_id=workset_id,
            )
        except TaskWriteError as exc:
            raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
        scheduler = get_scheduler(request)
        if scheduler is not None:
            await scheduler.register_task(task_id)
        _notify(request, task_id, "updated")
        row = await get_task_row(db, task_id)
        return task_response(row, await channel_refs_for(db, task_id), deleted=0)

    rrule = validate_task_rrule(effective_mode=effective_mode, supplied_rrule=body.rrule)

    # Every update bumps version: old markers become inert and incomplete
    # batches of the previous version are operationally superseded.
    new_version = int(existing.get("version") or 1) + 1
    now = utc_now_iso()
    if effective_mode == CALENDAR_TASK_MODE:
        # Filter-only: always clear channel links on write.
        refs = []
    else:
        refs = parse_channel_refs(body.channelIds) if body.channelIds is not None else None
    write_fields = calendar_task_write_fields(
        effective_mode=effective_mode,
        prompt_template=body.promptTemplate,
        rrule=rrule,
        event_start_time=body.eventStartTime,
        event_end_time=body.eventEndTime,
        event_is_all_day=body.eventIsAllDay,
        event_location=body.eventLocation,
        event_description=body.eventDescription,
    )
    include_in_timeline = resolve_include_in_timeline(
        effective_mode=effective_mode,
        supplied=body.includeInTimeline,
        existing=existing.get("include_in_timeline"),
    )
    # Non-recurring modes always clear parent_task_id; recurring keeps existing.
    try:
        parent_task_id = resolve_parent_task_id(
            task_id=task_id,
            effective_mode=effective_mode,
            supplied_parent_task_id=None,
            existing_parent_task_id=existing.get("parent_task_id"),
        )
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    workset_id = await resolve_workset_id(
        db,
        supplied=body.worksetId,
        existing=existing.get("workset_id"),
        fields_set=body.model_fields_set,
    )

    leaving_project = existing_mode == PARENT_PROJECT_MODE and effective_mode != PARENT_PROJECT_MODE

    channels_changed = False
    if refs is not None:
        current_channels = await fetch_task_channel_rows(db, task_id)
        current_set = {(str(row["platform"]), str(row["platform_id"])) for row in current_channels}
        new_set = {(platform, platform_id) for platform, platform_id in refs}
        channels_changed = current_set != new_set

    reset_project_cursor = should_reset_project_message_cursor(
        existing_mode=existing_mode,
        effective_mode=effective_mode,
        existing_prompt=str(existing.get("prompt_template") or ""),
        new_prompt=str(write_fields.get("prompt_template") or ""),
        channels_changed=channels_changed,
    )

    # Batch deletion, version bump, superseded-data purge and the channel swap
    # are one unit: any partial commit leaves the task version out of step with
    # the batches and channels that readers filter by.
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        deleted = await delete_incomplete_batches(conn, task_id)
        await update_analysis_task(
            tx,
            task_id=task_id,
            name=body.name.strip(),
            description=body.description,
            analysis_mode=effective_mode,
            analysis_time_range=body.analysisTimeRange or existing.get("analysis_time_range") or "all",
            version=new_version,
            schedule_type=body.scheduleType or existing.get("schedule_type") or "seconds_10",
            schedule_value=body.scheduleValue,
            include_in_timeline=include_in_timeline,
            parent_task_id=parent_task_id,
            workset_id=workset_id,
            now=now,
            **write_fields,
            **schedule_override_write_fields(body),
        )
        # Version bumped: purge result rows / batches of superseded versions so
        # they never linger as orphan data (readers already filter by current version).
        await purge_superseded_task_version_data(tx, task_id, new_version)

        # Project ticks use a message cursor (not analysis_markers). Only reset when
        # goals/sources change or the task enters/leaves project mode.
        if reset_project_cursor:
            await tx.execute(
                "DELETE FROM project_message_cursors WHERE task_id = ?",
                (task_id,),
            )

        if refs is not None:
            await replace_task_channels(tx, task_id, refs)

        # Project → other mode: detach children so parent_task_id never points at
        # a non-project row (clear links; do not 400-reject the mode change).
        if leaving_project:
            await clear_children_parent_links(tx, task_id, now=now)

    # External side effects stay outside the transaction, after the commit.
    scheduler = get_scheduler(request)
    if scheduler is not None:
        await scheduler.register_task(task_id)

    # Optional isActive: same path as PATCH …/active — no version bump for the toggle.
    if body.isActive is not None:
        desired = 1 if body.isActive else 0
        current = int(existing.get("is_active") or 0)
        if current != desired:
            await set_task_active(db, task_id, desired, utc_now_iso())
            if scheduler is not None:
                if desired:
                    await scheduler.register_task(task_id)
                else:
                    await scheduler.unregister_task(task_id)

    _notify(request, task_id, "updated")
    row = await get_task_row(db, task_id)
    return task_response(row, await channel_refs_for(db, task_id), deleted=len(deleted))


@router.delete("/{task_id}", response_model=TaskDeleteResponse)
async def delete_task(request: Request, task_id: str) -> dict:
    db = get_db(request)
    await get_task_row(db, task_id)

    # Unregister before the row disappears so no run can be triggered for a
    # task that no longer exists; re-register if the delete fails so a surviving
    # task is never left silently unscheduled.
    scheduler = get_scheduler(request)
    if scheduler is not None:
        await scheduler.unregister_task(task_id)

    try:
        # Batch cleanup and the row delete are one unit: committing the cleanup
        # alone leaves an orphan task whose schedule has already been torn down.
        async with db.transaction() as conn:
            deleted = await delete_incomplete_batches(conn, task_id)
            await delete_analysis_task(TransactionDb(conn), task_id)
    except Exception:
        if scheduler is not None:
            await scheduler.register_task(task_id)
        raise

    _notify(request, task_id, "deleted")
    return {
        "taskId": task_id,
        "deletedBatchCount": len(deleted),
    }


@router.patch("/{task_id}/active", response_model=TaskResponse)
async def toggle_task_active(request: Request, task_id: str) -> dict:
    db = get_db(request)
    existing = await get_task_row(db, task_id)
    new_active = 0 if existing.get("is_active") else 1
    await set_task_active(db, task_id, new_active, utc_now_iso())
    scheduler = get_scheduler(request)
    if scheduler is not None:
        if new_active:
            await scheduler.register_task(task_id)
        else:
            await scheduler.unregister_task(task_id)
    _notify(request, task_id, "updated")
    row = await get_task_row(db, task_id)
    return serialize_task(row, channel_refs=None)

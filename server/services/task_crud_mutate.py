"""Task create / update / delete / toggle mutation paths."""

from __future__ import annotations

from dataclasses import dataclass
from types import EllipsisType
from typing import Any

from server.api.channel_refs import parse_channel_refs
from server.api.routes.task_helpers import (
    TaskConfigBody,
    channel_refs_for,
    require_task_row,
    resolve_workset_id,
    schedule_override_write_fields,
    task_response,
)
from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import (
    CHILD_RECURRING_MODE,
    LEADERBOARD_MODE,
    PARENT_PROJECT_MODE,
    WEB_INTEL_MODE,
)
from server.domain.schedule import ScheduleValidationError, resolve_trigger_rrule
from server.queries.batch_housekeeping import purge_superseded_task_version_data
from server.queries.tasks_queries import (
    delete_incomplete_batches,
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
    clear_children_parent_links,
    resolve_include_in_timeline,
    should_reset_project_message_cursor,
)
from server.util import new_id, utc_now_iso
from server.wire.serializers import serialize_task


async def _require_task_row(db: Database, task_id: str) -> dict[str, Any]:
    """Service-layer alias: missing task → ``LookupError`` (routes map to 404)."""
    return await require_task_row(db, task_id, missing=LookupError)


@dataclass(frozen=True)
class TaskMutationResult:
    """Outcome of a create/update/delete that may need scheduler side effects."""

    task_id: str
    payload: dict[str, Any]
    register: bool = False
    unregister: bool = False
    #: After update, optional active toggle may need a second register/unregister.
    active_after: int | None = None


async def create_recurring_task_record(
    db: Database,
    *,
    name: str,
    rrule: str,
    event_start_time: str | None,
    event_end_time: str | None = None,
    event_is_all_day: bool = False,
    event_location: str | None = None,
    event_description: str | None = None,
    description: str | None = None,
    workset_id: str | None | EllipsisType = ...,
    parent_task_id: str | None = None,
) -> TaskMutationResult:
    """Atomic recurring create (task + schedule) — same path as the agent tool."""
    resolved_workset: str | None | EllipsisType
    if workset_id is ...:
        resolved_workset = ...
    else:
        resolved_workset = await resolve_workset_id(db, supplied=workset_id)
    row = await create_recurring_task(
        db,
        name=name,
        rrule=rrule,
        event_start_time=event_start_time,
        event_end_time=event_end_time,
        event_is_all_day=event_is_all_day,
        event_location=event_location,
        event_description=event_description,
        description=description,
        workset_id=resolved_workset,
        parent_task_id=parent_task_id,
    )
    task_id = str(row["id"])
    return TaskMutationResult(
        task_id=task_id,
        payload=task_response(row, await channel_refs_for(db, task_id), deleted=0),
        register=True,
    )


def _resolve_web_search_query(
    *,
    effective_mode: str,
    supplied: str | None,
    existing: str | None = None,
) -> str:
    # Retired for all modes including web_intel: Agent chooses keywords from prompt.
    del effective_mode, supplied, existing
    return ""


def _validate_web_intel_fields(*, effective_mode: str, prompt: str) -> None:
    if effective_mode != WEB_INTEL_MODE:
        return
    if not prompt.strip():
        raise TaskWriteError(
            "web_intel tasks require a non-empty promptTemplate "
            "(how the Agent should search and turn findings into events)"
        )


async def create_task_record(db: Database, body: TaskConfigBody) -> TaskMutationResult:
    effective_mode = body.analysisMode or LEADERBOARD_MODE

    if effective_mode == CHILD_RECURRING_MODE:
        raise TaskWriteError("POST /tasks with analysisMode=recurring is removed; use POST /tasks/recurring")

    task_id = new_id()
    now = utc_now_iso()
    # web_intel may optionally bind channels (message-threshold gate); omit = timed-only.
    refs = parse_channel_refs(body.channelIds)
    web_search_query = _resolve_web_search_query(
        effective_mode=effective_mode,
        supplied=body.webSearchQuery,
    )
    _validate_web_intel_fields(
        effective_mode=effective_mode,
        prompt=body.promptTemplate,
    )
    include_in_timeline = resolve_include_in_timeline(
        effective_mode=effective_mode,
        supplied=body.includeInTimeline,
    )
    workset_id = await resolve_workset_id(db, supplied=body.worksetId)
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        try:
            schedule_rrule = resolve_trigger_rrule(
                analysis_mode=effective_mode,
                schedule_rrule=body.scheduleRrule,
            )
        except (ScheduleValidationError, ValueError, TypeError) as exc:
            raise TaskWriteError(str(exc)) from exc
        await insert_analysis_task(
            tx,
            task_id=task_id,
            name=body.name.strip(),
            description=body.description,
            prompt_template=body.promptTemplate,
            analysis_mode=effective_mode,
            analysis_time_range=body.analysisTimeRange or "all",
            schedule_rrule=schedule_rrule,
            include_in_timeline=include_in_timeline,
            workset_id=workset_id,
            web_search_query=web_search_query,
            now=now,
            **schedule_override_write_fields(body),
        )
        await replace_task_channels(tx, task_id, refs)

    row = await _require_task_row(db, task_id)
    return TaskMutationResult(
        task_id=task_id,
        payload=task_response(row, await channel_refs_for(db, task_id), deleted=0),
        register=True,
    )


async def update_task_record(db: Database, task_id: str, body: TaskConfigBody) -> TaskMutationResult:
    existing = await _require_task_row(db, task_id)
    existing_mode = str(existing.get("analysis_mode") or "")
    effective_mode = body.analysisMode or existing_mode or LEADERBOARD_MODE
    if effective_mode == CHILD_RECURRING_MODE and existing_mode != CHILD_RECURRING_MODE:
        raise TaskWriteError("Changing an existing task to recurring is not supported; create a recurring task instead")

    if effective_mode == CHILD_RECURRING_MODE and existing_mode == CHILD_RECURRING_MODE:
        fields_set = body.model_fields_set
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
            is_active=body.isActive if "isActive" in fields_set else None,
            workset_id=workset_id,
        )
        row = await _require_task_row(db, task_id)
        return TaskMutationResult(
            task_id=task_id,
            payload=task_response(row, await channel_refs_for(db, task_id), deleted=0),
            register=True,
        )

    new_version = int(existing.get("version") or 1) + 1
    now = utc_now_iso()
    refs = parse_channel_refs(body.channelIds) if body.channelIds is not None else None
    web_search_query = _resolve_web_search_query(
        effective_mode=effective_mode,
        supplied=body.webSearchQuery if "webSearchQuery" in body.model_fields_set else None,
        existing=str(existing.get("web_search_query") or ""),
    )
    _validate_web_intel_fields(
        effective_mode=effective_mode,
        prompt=body.promptTemplate,
    )
    include_in_timeline = resolve_include_in_timeline(
        effective_mode=effective_mode,
        supplied=body.includeInTimeline,
        existing=existing.get("include_in_timeline"),
    )
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
        new_prompt=body.promptTemplate,
        channels_changed=channels_changed,
    )

    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        deleted = await delete_incomplete_batches(conn, task_id)
        try:
            schedule_rrule = resolve_trigger_rrule(
                analysis_mode=effective_mode,
                schedule_rrule=body.scheduleRrule,
                existing_rrule=existing.get("schedule_rrule"),
            )
        except (ScheduleValidationError, ValueError, TypeError) as exc:
            raise TaskWriteError(str(exc)) from exc
        await update_analysis_task(
            tx,
            task_id=task_id,
            name=body.name.strip(),
            description=body.description,
            prompt_template=body.promptTemplate,
            analysis_mode=effective_mode,
            analysis_time_range=body.analysisTimeRange or existing.get("analysis_time_range") or "all",
            version=new_version,
            schedule_rrule=schedule_rrule,
            include_in_timeline=include_in_timeline,
            workset_id=workset_id,
            web_search_query=web_search_query,
            now=now,
            **schedule_override_write_fields(body),
        )
        await purge_superseded_task_version_data(tx, task_id, new_version)

        if reset_project_cursor:
            await tx.execute(
                "DELETE FROM project_message_cursors WHERE task_id = ?",
                (task_id,),
            )

        if refs is not None:
            await replace_task_channels(tx, task_id, refs)

        if leaving_project:
            await clear_children_parent_links(tx, task_id, now=now)
        if existing_mode == CHILD_RECURRING_MODE:
            await tx.execute("DELETE FROM recurring_schedules WHERE task_id = ?", (task_id,))

    active_after: int | None = None
    if body.isActive is not None:
        desired = 1 if body.isActive else 0
        current = int(existing.get("is_active") or 0)
        if current != desired:
            await set_task_active(db, task_id, desired, utc_now_iso())
            active_after = desired

    row = await _require_task_row(db, task_id)
    return TaskMutationResult(
        task_id=task_id,
        payload=task_response(row, await channel_refs_for(db, task_id), deleted=len(deleted)),
        register=True,
        active_after=active_after,
    )


async def delete_task_record(db: Database, task_id: str) -> dict[str, Any]:
    await _require_task_row(db, task_id)
    # Resolve through the façade so tests can monkeypatch ``task_crud.delete_analysis_task``.
    from server.services import task_crud as task_crud_facade

    async with db.transaction() as conn:
        deleted = await delete_incomplete_batches(conn, task_id)
        await task_crud_facade.delete_analysis_task(TransactionDb(conn), task_id)
    return {
        "taskId": task_id,
        "deletedBatchCount": len(deleted),
    }


async def toggle_task_active_record(db: Database, task_id: str) -> tuple[dict[str, Any], int]:
    existing = await _require_task_row(db, task_id)
    new_active = 0 if existing.get("is_active") else 1
    await set_task_active(db, task_id, new_active, utc_now_iso())
    row = await _require_task_row(db, task_id)
    return serialize_task(row, channel_refs=None), new_active

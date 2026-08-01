"""Task CRUD orchestration shared by REST routes (and future writers).

HTTP concerns (status codes, SSE notify, scheduler register) stay in the route
layer; this module owns the transactional write path and list filtering.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from server.api.channel_refs import parse_channel_refs
from server.api.routes.task_helpers import (
    ALLOWED_MODES,
    TaskConfigBody,
    channel_refs_for,
    resolve_workset_id,
    schedule_override_write_fields,
    task_response,
)
from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import (
    CHILD_RECURRING_MODE,
    LEADERBOARD_MODE,
    PARENT_PROJECT_MODE,
)
from server.queries.batch_housekeeping import purge_superseded_task_version_data
from server.queries.tasks_queries import (
    delete_analysis_task,
    delete_incomplete_batches,
    fetch_all_task_channel_rows,
    fetch_all_task_rows,
    fetch_task_channel_rows,
    fetch_task_row,
    insert_analysis_task,
    replace_task_channels,
    set_task_active,
    update_analysis_task,
)
from server.services.recurring_task_writes import (
    create_recurring_task_shell,
    patch_recurring_task,
)
from server.services.task_writes import (
    TaskWriteError,
    clear_children_parent_links,
    resolve_include_in_timeline,
    should_reset_project_message_cursor,
)
from server.util import new_id, utc_now_iso
from server.wire.serializers import serialize_channel_ref, serialize_task


async def _require_task_row(db: Database, task_id: str) -> dict[str, Any]:
    row = await fetch_task_row(db, task_id)
    if row is None:
        raise LookupError("Task not found")
    return row


@dataclass(frozen=True)
class TaskMutationResult:
    """Outcome of a create/update/delete that may need scheduler side effects."""

    task_id: str
    payload: dict[str, Any]
    register: bool = False
    unregister: bool = False
    #: After update, optional active toggle may need a second register/unregister.
    active_after: int | None = None


async def list_tasks_payload(
    db: Database,
    *,
    top_level_only: bool = False,
    analysis_mode: Optional[str] = None,
    workset_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    rows = await fetch_all_task_rows(db)
    if top_level_only:
        rows = [row for row in rows if not row.get("parent_task_id")]
    if analysis_mode is not None:
        mode = analysis_mode.strip()
        if mode not in ALLOWED_MODES:
            raise TaskWriteError(f"Invalid analysis_mode: {analysis_mode}")
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


async def create_task_record(db: Database, body: TaskConfigBody) -> TaskMutationResult:
    effective_mode = body.analysisMode or LEADERBOARD_MODE

    if effective_mode == CHILD_RECURRING_MODE:
        row = await create_recurring_task_shell(
            db,
            name=body.name.strip(),
            description=body.description,
            workset_id=await resolve_workset_id(db, supplied=body.worksetId),
        )
        task_id = str(row["id"])
        if body.isActive is not None and not body.isActive:
            await set_task_active(db, task_id, 0, utc_now_iso())
        row = await _require_task_row(db, task_id)
        return TaskMutationResult(
            task_id=task_id,
            payload=task_response(row, await channel_refs_for(db, task_id), deleted=0),
            register=True,
        )

    task_id = new_id()
    now = utc_now_iso()
    refs = parse_channel_refs(body.channelIds)
    include_in_timeline = resolve_include_in_timeline(
        effective_mode=effective_mode,
        supplied=body.includeInTimeline,
    )
    workset_id = await resolve_workset_id(db, supplied=body.worksetId)
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await insert_analysis_task(
            tx,
            task_id=task_id,
            name=body.name.strip(),
            description=body.description,
            prompt_template=body.promptTemplate,
            analysis_mode=effective_mode,
            analysis_time_range=body.analysisTimeRange or "all",
            schedule_type=body.scheduleType or ("hourly" if effective_mode == "project" else "seconds_10"),
            schedule_value=body.scheduleValue,
            include_in_timeline=include_in_timeline,
            workset_id=workset_id,
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
        await update_analysis_task(
            tx,
            task_id=task_id,
            name=body.name.strip(),
            description=body.description,
            prompt_template=body.promptTemplate,
            analysis_mode=effective_mode,
            analysis_time_range=body.analysisTimeRange or existing.get("analysis_time_range") or "all",
            version=new_version,
            schedule_type=body.scheduleType or existing.get("schedule_type") or "seconds_10",
            schedule_value=body.scheduleValue,
            include_in_timeline=include_in_timeline,
            workset_id=workset_id,
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
    async with db.transaction() as conn:
        deleted = await delete_incomplete_batches(conn, task_id)
        await delete_analysis_task(TransactionDb(conn), task_id)
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

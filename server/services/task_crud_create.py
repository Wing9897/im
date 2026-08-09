"""Task create mutation paths (analysis + recurring)."""

from __future__ import annotations

from types import EllipsisType
from typing import Any

from server.api.channel_refs import parse_channel_refs
from server.api.routes.task_helpers import (
    TaskConfigBody,
    agent_policy_write_fields,
    channel_refs_for,
    resolve_workset_id,
    schedule_override_write_fields,
    task_response,
)
from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import (
    CHILD_RECURRING_MODE,
    LEADERBOARD_MODE,
)
from server.domain.schedule import ScheduleValidationError, resolve_trigger_rrule
from server.queries.tasks_queries import (
    insert_analysis_task,
    replace_task_channels,
)
from server.services.recurring_task_writes import create_recurring_task
from server.services.task_crud_mutate_common import (
    TaskMutationResult,
    require_task_row_or_lookup,
    validate_agent_prompt,
)
from server.services.task_writes import (
    TaskWriteError,
    resolve_include_in_timeline,
)
from server.util import new_id, utc_now_iso


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
    item_id: str | None = None,
) -> TaskMutationResult:
    """Atomic recurring create (task + schedule) — same path as the agent tool."""
    from server.calendar.user_events_normalize import (
        UserEventItemIdError,
        resolve_user_event_item_id,
    )

    resolved_workset: str | None | EllipsisType
    if workset_id is ...:
        resolved_workset = ...
    else:
        resolved_workset = await resolve_workset_id(db, supplied=workset_id)
    try:
        clean_item_id = await resolve_user_event_item_id(db, item_id)
    except UserEventItemIdError as exc:
        raise TaskWriteError(str(exc)) from exc
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
        item_id=clean_item_id,
    )
    task_id = str(row["id"])
    return TaskMutationResult(
        task_id=task_id,
        payload=task_response(row, await channel_refs_for(db, task_id), deleted=0),
        register=True,
    )


async def create_task_record(db: Database, body: TaskConfigBody) -> TaskMutationResult:
    effective_mode = body.analysisMode or LEADERBOARD_MODE

    if effective_mode == CHILD_RECURRING_MODE:
        raise TaskWriteError("POST /tasks with analysisMode=recurring is removed; use POST /tasks/recurring")

    task_id = new_id()
    now = utc_now_iso()
    refs = parse_channel_refs(body.channelIds)
    validate_agent_prompt(
        effective_mode=effective_mode,
        prompt=body.promptTemplate,
    )
    include_in_timeline = resolve_include_in_timeline(
        effective_mode=effective_mode,
        supplied=body.includeInTimeline,
    )
    workset_id = await resolve_workset_id(db, supplied=body.worksetId)
    agent_fields = agent_policy_write_fields(
        effective_mode=effective_mode,
        body=body,
        has_channels=bool(refs),
    )
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
            now=now,
            **schedule_override_write_fields(body),
            **agent_fields,
        )
        await replace_task_channels(tx, task_id, refs)

    row = await require_task_row_or_lookup(db, task_id)
    return TaskMutationResult(
        task_id=task_id,
        payload=task_response(row, await channel_refs_for(db, task_id), deleted=0),
        register=True,
    )


__all__ = [
    "create_recurring_task_record",
    "create_task_record",
]

"""Task create mutation path (AI analysis modes only)."""

from __future__ import annotations

from server.api.channel_refs import parse_channel_refs
from server.api.routes.task_helpers import (
    TaskConfigBody,
    channel_refs_for,
    resolve_llm_profile_id,
    task_response,
)
from server.services.task_policy import (
    agent_policy_write_fields,
    resolve_workset_id,
    schedule_override_write_fields,
)
from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import LEADERBOARD_MODE
from server.domain.notify_prefs import normalize_notify_pref
from server.domain.schedule import ScheduleValidationError, resolve_trigger_rrule
from server.queries.tasks_queries import (
    insert_analysis_task,
    replace_task_channels,
)
from server.services.task_crud_mutate_common import (
    TaskMutationResult,
    task_emoji_from_body,
    validate_agent_prompt,
    validate_task_config_body,
)
from server.services.task_writes import (
    TaskWriteError,
    resolve_include_in_timeline,
)
from server.util import new_id, utc_now_iso


async def create_task_record(db: Database, body: TaskConfigBody) -> TaskMutationResult:
    validate_task_config_body(body)
    effective_mode = body.analysisMode or LEADERBOARD_MODE

    if effective_mode == "recurring":
        raise TaskWriteError("analysisMode=recurring is removed; use POST /api/v1/calendar/recurring")

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
    llm_profile_id = await resolve_llm_profile_id(db, supplied=body.llmProfileId)
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
            llm_profile_id=llm_profile_id,
            notify_pref=normalize_notify_pref(body.notifyPref),
            emoji=task_emoji_from_body(body, existing=None),
            now=now,
            **schedule_override_write_fields(body),
            **agent_fields,
        )
        if refs:
            await replace_task_channels(tx, task_id, refs)

    row = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))
    if row is None:
        raise TaskWriteError("failed to create task")
    return TaskMutationResult(
        task_id=task_id,
        payload=task_response(row, await channel_refs_for(db, task_id), deleted=0),
        register=True,
    )


__all__ = ["create_task_record"]

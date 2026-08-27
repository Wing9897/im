"""Task update mutation path (AI analysis modes only)."""

from __future__ import annotations

from typing import Any

from server.api.channel_refs import parse_channel_refs
from server.api.routes.task_helpers import (
    TaskConfigBody,
    channel_refs_for,
    resolve_llm_profile_id,
    task_response,
)
from server.db.database import Database, TransactionDb
from server.domain.analysis_modes import (
    AGENT_MODE,
    LEADERBOARD_MODE,
)
from server.domain.notify_prefs import normalize_notify_pref
from server.domain.schedule import ScheduleValidationError, resolve_trigger_rrule
from server.queries.batch_housekeeping import purge_superseded_task_version_data
from server.queries.tasks_queries import (
    delete_incomplete_batches,
    fetch_task_channel_rows,
    replace_task_channels,
    set_task_active,
    set_task_emoji,
    update_analysis_task,
)
from server.services.task_crud_mutate_common import (
    TaskMutationResult,
    require_task_row_or_lookup,
    task_emoji_from_body,
    validate_agent_prompt,
    validate_task_config_body,
)
from server.services.task_policy import (
    agent_policy_write_fields,
    resolve_workset_id,
    schedule_override_write_fields,
)
from server.services.task_writes import (
    TaskWriteError,
    clear_children_parent_links,
    resolve_include_in_timeline,
    should_reset_agent_message_cursor,
)
from server.util import utc_now_iso


async def update_task_record(db: Database, task_id: str, body: TaskConfigBody) -> TaskMutationResult:
    validate_task_config_body(body)
    existing = await require_task_row_or_lookup(db, task_id)
    existing_mode = str(existing.get("analysis_mode") or "")
    effective_mode = body.analysisMode or existing_mode or LEADERBOARD_MODE
    if effective_mode == "recurring" or existing_mode == "recurring":
        raise TaskWriteError("analysisMode=recurring is removed; use /api/v1/calendar/recurring")

    new_version = int(existing.get("version") or 1) + 1
    now = utc_now_iso()
    refs = parse_channel_refs(body.channelIds) if body.channelIds is not None else None
    validate_agent_prompt(
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
    llm_profile_id = await resolve_llm_profile_id(
        db,
        supplied=body.llmProfileId,
        existing=existing.get("llm_profile_id"),
        fields_set=body.model_fields_set,
    )

    existing_was_agent_parent = existing_mode == AGENT_MODE and bool(existing.get("output_calendar"))
    leaving_agent_parent = existing_was_agent_parent and (
        effective_mode != AGENT_MODE or ("outputCalendar" in body.model_fields_set and body.outputCalendar is False)
    )

    channels_changed = False
    channel_count_for_policy: bool | None = None
    if refs is not None:
        current_channels = await fetch_task_channel_rows(db, task_id)
        current_set = {(str(row["platform"]), str(row["platform_id"])) for row in current_channels}
        new_set = {(platform, platform_id) for platform, platform_id in refs}
        channels_changed = current_set != new_set
        channel_count_for_policy = bool(refs)
    else:
        current_channels = await fetch_task_channel_rows(db, task_id)
        channel_count_for_policy = bool(current_channels)

    agent_fields = agent_policy_write_fields(
        effective_mode=effective_mode,
        body=body,
        existing=existing,
        has_channels=channel_count_for_policy,
    )

    reset_agent_cursor = should_reset_agent_message_cursor(
        existing_mode=existing_mode,
        effective_mode=effective_mode,
        existing_trigger=str(existing.get("trigger_mode") or ""),
        effective_trigger=str(agent_fields.get("trigger_mode") or ""),
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
            llm_profile_id=llm_profile_id,
            notify_pref=normalize_notify_pref(
                body.notifyPref,
                default=normalize_notify_pref(existing.get("notify_pref")),
            ),
            emoji=task_emoji_from_body(body, existing=existing),
            now=now,
            **schedule_override_write_fields(body),
            **agent_fields,
        )
        await purge_superseded_task_version_data(tx, task_id, new_version)

        if reset_agent_cursor:
            await tx.execute(
                "DELETE FROM agent_message_cursors WHERE task_id = ?",
                (task_id,),
            )

        if refs is not None:
            await replace_task_channels(tx, task_id, refs)

        if leaving_agent_parent or (existing_mode == AGENT_MODE and effective_mode != AGENT_MODE):
            await clear_children_parent_links(tx, task_id, now=now)

    prev_workset = str(existing.get("workset_id") or "")
    prev_timeline = bool(existing.get("include_in_timeline"))
    if prev_workset != str(workset_id or "") or prev_timeline != bool(include_in_timeline):
        from server.calendar_share.dirty import mark_published_workset_dirty

        await mark_published_workset_dirty(db, prev_workset, str(workset_id or ""))

    if body.isActive is not None:
        desired = 1 if body.isActive else 0
        current = int(existing.get("is_active") or 0)
        if current != desired:
            if desired:
                from server.analyzer.llm_config import require_complete_profile_row

                await require_complete_profile_row(db, llm_profile_id)
            await set_task_active(db, task_id, desired, utc_now_iso())

    row = await require_task_row_or_lookup(db, task_id)
    return TaskMutationResult(
        task_id=task_id,
        payload=task_response(row, await channel_refs_for(db, task_id), deleted=len(deleted)),
        register=True,
    )


async def patch_task_emoji_record(db: Database, task_id: str, emoji: str | None) -> dict[str, Any]:
    """Update only the card glyph; does not bump analysis version."""
    from server.api.routes.task_helpers import channel_refs_for, task_response
    from server.domain.emoji import EmojiValidationError, normalize_optional_emoji

    await require_task_row_or_lookup(db, task_id)
    try:
        clean = normalize_optional_emoji(emoji)
    except EmojiValidationError as exc:
        raise TaskWriteError(str(exc)) from exc
    await set_task_emoji(db, task_id, clean, utc_now_iso())
    row = await require_task_row_or_lookup(db, task_id)
    return task_response(row, await channel_refs_for(db, task_id), deleted=0)


__all__ = ["update_task_record", "patch_task_emoji_record"]

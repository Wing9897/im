"""Validation and response assembly shared by task routes.

HTTP-agnostic body validation lives in ``services.task_crud_mutate_common``;
routes catch ``TaskWriteError`` and map to 422.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from server.api.schemas.requests import TaskConfigBody
from server.domain.analysis_modes import ALL_ANALYSIS_MODES
from server.errors import VALIDATION_ERROR, http_error
from server.queries.tasks_queries import fetch_task_channel_rows, fetch_task_row, fetch_task_workset_id
from server.queries.worksets_queries import workset_exists
from server.wire.serializers import serialize_channel_ref, serialize_task

ALLOWED_MODES = ALL_ANALYSIS_MODES
# FE editor presets live in ``ALLOWED_SCHEDULE_PRESETS`` (domain); not on HTTP wire.

# Recurring calendar RRULE lives on /api/v1/calendar/recurring (not TaskConfigBody).
# Recurring-only recurrence expanded at query time — never an AI analysis trigger.
# AI trigger schedules use RRULE-shaped strings (purpose=trigger) for APScheduler
# only and must never calendar-expand.


def schedule_override_write_fields(body: TaskConfigBody) -> dict[str, Any]:
    """Map optional TaskConfigBody scheduling overrides to DB column kwargs."""
    return {
        "agent_wave_interval_seconds": body.agentWaveIntervalSeconds,
        "batch_overlap_count": body.batchOverlapCount,
        "analysis_trigger_threshold": body.analysisTriggerThreshold,
        "analysis_batch_message_limit": body.analysisBatchMessageLimit,
        "analysis_strategy_mode": body.analysisStrategyMode,
    }


def agent_policy_write_fields(
    *,
    effective_mode: str,
    body: TaskConfigBody,
    existing: dict[str, Any] | None = None,
    has_channels: bool | None = None,
) -> dict[str, Any]:
    """Normalize agent policy for INSERT/UPDATE; inert defaults for non-agent modes."""
    from server.domain.agent_task_spec import (
        AgentTaskSpec,
        AgentTaskSpecError,
        agent_spec_to_db_kwargs,
        normalize_agent_task_spec,
    )
    from server.domain.analysis_modes import AGENT_MODE
    from server.services.task_writes import TaskWriteError

    if effective_mode != AGENT_MODE:
        return agent_spec_to_db_kwargs(
            AgentTaskSpec(
                trigger_mode="schedule",
                cap_calendar_read=True,
                cap_calendar_writes=False,
                cap_web_search=False,
                cap_force_web_search=False,
                cap_read_analysis_events=True,
                cap_read_items=True,
                output_calendar=False,
                output_analysis_events=False,
            )
        )

    existing = existing or {}
    fields = body.model_fields_set

    def _pick_bool(wire: str, column: str, default: bool) -> bool | None:
        if wire in fields:
            return getattr(body, wire)
        if existing:
            return bool(existing.get(column, default))
        return default

    try:
        spec = normalize_agent_task_spec(
            trigger_mode=(
                body.triggerMode if "triggerMode" in fields else (existing.get("trigger_mode") or "schedule")
            ),
            cap_calendar_read=_pick_bool("capCalendarRead", "cap_calendar_read", True),
            cap_calendar_writes=_pick_bool("capCalendarWrites", "cap_calendar_writes", False),
            cap_web_search=_pick_bool("capWebSearch", "cap_web_search", False),
            cap_force_web_search=_pick_bool("capForceWebSearch", "cap_force_web_search", False),
            cap_read_analysis_events=_pick_bool("capReadAnalysisEvents", "cap_read_analysis_events", True),
            cap_read_items=_pick_bool("capReadItems", "cap_read_items", True),
            output_calendar=_pick_bool("outputCalendar", "output_calendar", False),
            output_analysis_events=_pick_bool("outputAnalysisEvents", "output_analysis_events", False),
            has_channels=has_channels,
        )
    except AgentTaskSpecError as exc:
        raise TaskWriteError(str(exc)) from exc
    return agent_spec_to_db_kwargs(spec)


async def resolve_workset_id(
    db: Any,
    *,
    supplied: str | None,
    existing: str | None = None,
    inherit_from_parent_id: str | None = None,
    fields_set: set[str] | None = None,
) -> str | None:
    """Normalize optional workset ownership.

    - Explicit ``worksetId`` (including null/empty → clear) when in ``fields_set`` or
      when ``fields_set`` is None (create path treats body.worksetId as authoritative).
    - Else inherit from parent project when creating a child without an explicit value.
    - Else keep ``existing`` on update.
    """
    explicit = fields_set is None or "worksetId" in fields_set
    if explicit:
        if supplied is None or not str(supplied).strip():
            return None
        workset_id = str(supplied).strip()
        if not await workset_exists(db, workset_id):
            raise http_error(422, f"Unknown worksetId: {workset_id}", error_code=VALIDATION_ERROR)
        return workset_id

    if inherit_from_parent_id:
        parent_workset_id = await fetch_task_workset_id(db, inherit_from_parent_id)
        if parent_workset_id:
            return parent_workset_id

    return existing or None


async def resolve_llm_profile_id(
    db: Any,
    *,
    supplied: str | None,
    existing: str | None = None,
    fields_set: set[str] | None = None,
    require_complete: bool = True,
) -> str:
    """Resolve required llm_profile_id; fall back to oldest profile when omitted.

    Never invents a fake ``__default__`` id. When no profiles exist (or the
    chosen profile is incomplete), raises 400 with a clear message.
    """
    from server.analyzer.llm_config import fetch_first_profile_id, require_complete_profile_row
    from server.queries.llm_profiles_queries import fetch_profile_row

    explicit = fields_set is None or "llmProfileId" in fields_set
    profile_id: str | None = None
    if explicit and supplied is not None and str(supplied).strip():
        profile_id = str(supplied).strip()
        if await fetch_profile_row(db, profile_id) is None:
            raise http_error(400, f"Unknown llmProfileId: {profile_id}", error_code=VALIDATION_ERROR)
    elif existing and str(existing).strip():
        profile_id = str(existing).strip()
    else:
        profile_id = await fetch_first_profile_id(db)

    if require_complete:
        await require_complete_profile_row(db, profile_id)
    return profile_id


async def require_task_row(
    db: Any,
    task_id: str,
    *,
    missing: Callable[[str], BaseException] | type[BaseException] = LookupError,
) -> dict[str, Any]:
    """Load a task row or raise a parameterized not-found error.

    ``missing`` may be an exception type (``LookupError``) or a factory
    (``lambda msg: http_error(404, msg)``) so HTTP routes and service-layer
    writers share one fetch path.
    """
    row = await fetch_task_row(db, task_id)
    if row is None:
        message = "Task not found"
        if isinstance(missing, type) and issubclass(missing, BaseException):
            raise missing(message)
        raise missing(message)
    return row


async def channel_refs_for(db: Any, task_id: str) -> list[dict[str, Any]]:
    rows = await fetch_task_channel_rows(db, task_id)
    return [serialize_channel_ref(row) for row in rows]


def task_response(
    row: dict[str, Any],
    channel_refs: list[dict[str, Any]] | None,
    *,
    deleted: int = 0,
) -> dict:
    result = serialize_task(row, channel_refs)
    result.update({"deletedBatchCount": deleted})
    return result

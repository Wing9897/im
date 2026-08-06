"""Validation and response assembly shared by task routes."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from server.api.schemas.requests import TaskConfigBody
from server.db.schema_domains.vocabulary import ANALYSIS_TIME_RANGE_VALUES
from server.domain.analysis_modes import ALL_ANALYSIS_MODES
from server.domain.schedule import ScheduleValidationError, resolve_trigger_rrule
from server.errors import VALIDATION_ERROR, http_error
from server.queries.tasks_queries import fetch_task_channel_rows, fetch_task_row, fetch_task_workset_id
from server.queries.worksets_queries import workset_exists
from server.scheduler.task_schedule_overrides import (
    ALLOWED_STRATEGY_MODES,
    ANALYSIS_BATCH_LIMIT_MAX,
    ANALYSIS_BATCH_LIMIT_MIN,
    ANALYSIS_THRESHOLD_MAX,
    ANALYSIS_THRESHOLD_MIN,
    BATCH_OVERLAP_MAX,
    BATCH_OVERLAP_MIN,
    PROJECT_WAVE_INTERVAL_MAX,
    PROJECT_WAVE_INTERVAL_MIN,
)
from server.wire.serializers import serialize_channel_ref, serialize_task

ALLOWED_MODES = ALL_ANALYSIS_MODES
# FE editor presets live in ``ALLOWED_SCHEDULE_PRESETS`` (domain); not on HTTP wire.

# Recurring calendar RRULE lives on PUT /tasks/{id}/schedule (not TaskConfigBody).
# Recurring-only recurrence expanded at query time — never an AI analysis trigger.
# AI trigger schedules use RRULE-shaped strings (purpose=trigger) for APScheduler
# only and must never calendar-expand.


def _validate_optional_int_in_range(
    label: str,
    value: int | None,
    *,
    minimum: int,
    maximum: int,
) -> None:
    if value is None:
        return
    if value < minimum or value > maximum:
        raise http_error(
            422,
            f"{label} must be between {minimum} and {maximum}",
            error_code=VALIDATION_ERROR,
        )


def validate_task_body(body: TaskConfigBody) -> None:
    if not body.name.strip():
        raise http_error(422, "Task name is required", error_code=VALIDATION_ERROR)
    if body.analysisMode is not None and body.analysisMode not in ALLOWED_MODES:
        raise http_error(
            422,
            f"Invalid analysisMode: {body.analysisMode}",
            error_code=VALIDATION_ERROR,
        )
    if body.analysisTimeRange is not None and body.analysisTimeRange not in ANALYSIS_TIME_RANGE_VALUES:
        raise http_error(
            422,
            f"Invalid analysisTimeRange: {body.analysisTimeRange}",
            error_code=VALIDATION_ERROR,
        )
    if body.scheduleRrule is not None:
        try:
            resolve_trigger_rrule(
                analysis_mode=body.analysisMode,
                schedule_rrule=body.scheduleRrule,
            )
        except (ScheduleValidationError, ValueError, TypeError) as exc:
            raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    if body.analysisStrategyMode is not None and body.analysisStrategyMode not in ALLOWED_STRATEGY_MODES:
        raise http_error(
            422,
            f"Invalid analysisStrategyMode: {body.analysisStrategyMode}",
            error_code=VALIDATION_ERROR,
        )
    _validate_optional_int_in_range(
        "projectWaveIntervalSeconds",
        body.projectWaveIntervalSeconds,
        minimum=PROJECT_WAVE_INTERVAL_MIN,
        maximum=PROJECT_WAVE_INTERVAL_MAX,
    )
    _validate_optional_int_in_range(
        "batchOverlapCount",
        body.batchOverlapCount,
        minimum=BATCH_OVERLAP_MIN,
        maximum=BATCH_OVERLAP_MAX,
    )
    _validate_optional_int_in_range(
        "analysisTriggerThreshold",
        body.analysisTriggerThreshold,
        minimum=ANALYSIS_THRESHOLD_MIN,
        maximum=ANALYSIS_THRESHOLD_MAX,
    )
    _validate_optional_int_in_range(
        "analysisBatchMessageLimit",
        body.analysisBatchMessageLimit,
        minimum=ANALYSIS_BATCH_LIMIT_MIN,
        maximum=ANALYSIS_BATCH_LIMIT_MAX,
    )


def schedule_override_write_fields(body: TaskConfigBody) -> dict[str, Any]:
    """Map optional TaskConfigBody scheduling overrides to DB column kwargs."""
    return {
        "project_wave_interval_seconds": body.projectWaveIntervalSeconds,
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
                body.triggerMode
                if "triggerMode" in fields
                else (existing.get("trigger_mode") or "schedule")
            ),
            cap_calendar_read=_pick_bool("capCalendarRead", "cap_calendar_read", True),
            cap_calendar_writes=_pick_bool("capCalendarWrites", "cap_calendar_writes", False),
            cap_web_search=_pick_bool("capWebSearch", "cap_web_search", False),
            cap_force_web_search=_pick_bool("capForceWebSearch", "cap_force_web_search", False),
            cap_read_analysis_events=_pick_bool(
                "capReadAnalysisEvents", "cap_read_analysis_events", True
            ),
            cap_read_items=_pick_bool("capReadItems", "cap_read_items", True),
            output_calendar=_pick_bool("outputCalendar", "output_calendar", False),
            output_analysis_events=_pick_bool(
                "outputAnalysisEvents", "output_analysis_events", False
            ),
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


async def get_task_row(db: Any, task_id: str) -> dict[str, Any]:
    """HTTP helper: missing task → 404 ``http_error``."""
    return await require_task_row(db, task_id, missing=lambda msg: http_error(404, msg))


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

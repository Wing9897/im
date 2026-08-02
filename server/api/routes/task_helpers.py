"""Validation and response assembly shared by task routes."""

from __future__ import annotations

from typing import Any, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from server.db.schema_ddl import ANALYSIS_TIME_RANGE_VALUES
from server.domain.analysis_modes import ALL_ANALYSIS_MODES, AnalysisMode
from server.domain.schedule import ALLOWED_SCHEDULE_PRESETS, ScheduleValidationError, resolve_trigger_rrule
from server.errors import VALIDATION_ERROR, http_error
from server.queries.tasks_queries import fetch_task_channel_rows, fetch_task_row
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
from server.services.task_writes import TaskWriteError, validate_task_recurrence
from server.wire.serializers import serialize_channel_ref, serialize_task

ALLOWED_MODES = ALL_ANALYSIS_MODES
#: Wire preset vocabulary; persisted as trigger-purpose ``schedule_rrule``.
ALLOWED_SCHEDULE_TYPES = ("seconds_10", "hourly", "daily", "weekly", "custom_seconds")
assert frozenset(ALLOWED_SCHEDULE_TYPES) == frozenset(ALLOWED_SCHEDULE_PRESETS)

# Recurring calendar RRULE lives on PUT /tasks/{id}/schedule (not TaskConfigBody).
# Recurring-only recurrence expanded at query time — never an AI analysis trigger.
# AI trigger schedules use RRULE-shaped strings (purpose=trigger) for APScheduler
# only and must never calendar-expand.


class TaskConfigBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: Optional[str] = None
    promptTemplate: str = ""
    #: Search query / keywords for ``analysisMode=web_intel`` (ignored otherwise).
    webSearchQuery: Optional[str] = None
    analysisMode: Optional[AnalysisMode] = None
    analysisTimeRange: Optional[str] = None
    channelIds: Optional[list[Union[str, dict[str, Any]]]] = None
    scheduleType: Optional[str] = Field(
        default=None,
        description=(
            "Read-compat FE preset mirror (maps to scheduleRrule). "
            "Write path should send scheduleRrule; accepted only when scheduleRrule is omitted."
        ),
    )
    scheduleValue: Optional[str] = Field(
        default=None,
        description=(
            "Read-compat value for scheduleType presets. "
            "Ignored when scheduleRrule is provided."
        ),
    )
    scheduleRrule: Optional[str] = Field(
        default=None,
        description=(
            "Canonical trigger-purpose RRULE for AI modes (APScheduler next-run only). "
            "Never calendar-expanded. Create/update write SoT — prefer this alone over "
            "scheduleType/scheduleValue."
        ),
    )
    includeInTimeline: Optional[bool] = None
    isActive: Optional[bool] = None
    #: Task-owned (project): null/omit → resolve to 20; not a global config fallback.
    projectWaveIntervalSeconds: Optional[int] = Field(
        default=None, ge=PROJECT_WAVE_INTERVAL_MIN, le=PROJECT_WAVE_INTERVAL_MAX
    )
    #: Task-owned (event): null/omit → resolve to 0; not a global config fallback.
    batchOverlapCount: Optional[int] = Field(default=None, ge=BATCH_OVERLAP_MIN, le=BATCH_OVERLAP_MAX)
    #: Follow AI Settings when null/omit (event/leaderboard overrides).
    analysisTriggerThreshold: Optional[int] = Field(default=None, ge=ANALYSIS_THRESHOLD_MIN, le=ANALYSIS_THRESHOLD_MAX)
    analysisBatchMessageLimit: Optional[int] = Field(
        default=None, ge=ANALYSIS_BATCH_LIMIT_MIN, le=ANALYSIS_BATCH_LIMIT_MAX
    )
    analysisStrategyMode: Optional[str] = None
    worksetId: Optional[str] = None


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
    if body.scheduleType is not None and body.scheduleType not in ALLOWED_SCHEDULE_TYPES:
        raise http_error(
            422,
            f"Invalid scheduleType: {body.scheduleType}",
            error_code=VALIDATION_ERROR,
        )
    if body.scheduleRrule is not None or body.scheduleType is not None:
        try:
            resolve_trigger_rrule(
                analysis_mode=body.analysisMode,
                schedule_type=body.scheduleType,
                schedule_value=body.scheduleValue,
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


def validate_task_rrule(*, effective_mode: str, supplied_rrule: str | None) -> str | None:
    try:
        return validate_task_recurrence(
            effective_mode=effective_mode,
            supplied_rrule=supplied_rrule,
        )
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc


def schedule_override_write_fields(body: TaskConfigBody) -> dict[str, Any]:
    """Map optional TaskConfigBody scheduling overrides to DB column kwargs."""
    return {
        "project_wave_interval_seconds": body.projectWaveIntervalSeconds,
        "batch_overlap_count": body.batchOverlapCount,
        "analysis_trigger_threshold": body.analysisTriggerThreshold,
        "analysis_batch_message_limit": body.analysisBatchMessageLimit,
        "analysis_strategy_mode": body.analysisStrategyMode,
    }


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
        parent = await db.fetch_one(
            "SELECT workset_id FROM analysis_tasks WHERE id = ?",
            (inherit_from_parent_id,),
        )
        if parent and parent.get("workset_id"):
            return str(parent["workset_id"])

    return existing or None


async def get_task_row(db: Any, task_id: str) -> dict[str, Any]:
    row = await fetch_task_row(db, task_id)
    if row is None:
        raise http_error(404, "Task not found")
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

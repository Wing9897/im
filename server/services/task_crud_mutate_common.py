"""Shared types / validation for task CRUD mutations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from server.api.schemas.requests import TaskConfigBody
from server.db.database import Database
from server.domain.analysis_modes import AGENT_MODE, ALL_ANALYSIS_MODES
from server.domain.analysis_time_ranges import ALLOWED_ANALYSIS_TIME_RANGES
from server.domain.emoji import EmojiValidationError, emoji_from_row, normalize_optional_emoji
from server.domain.schedule import ScheduleValidationError, resolve_trigger_rrule
from server.scheduler.task_schedule_overrides import (
    AGENT_WAVE_INTERVAL_MAX,
    AGENT_WAVE_INTERVAL_MIN,
    ALLOWED_STRATEGY_MODES,
    ANALYSIS_BATCH_LIMIT_MAX,
    ANALYSIS_BATCH_LIMIT_MIN,
    ANALYSIS_THRESHOLD_MAX,
    ANALYSIS_THRESHOLD_MIN,
    BATCH_OVERLAP_MAX,
    BATCH_OVERLAP_MIN,
)
from server.services.task_policy import require_task_row
from server.services.task_writes import TaskWriteError


@dataclass(frozen=True)
class TaskMutationResult:
    """Outcome of a create/update/delete that may need scheduler side effects."""

    task_id: str
    payload: dict[str, Any]
    register: bool = False
    unregister: bool = False
    #: After update, optional active toggle may need a second register/unregister.
    active_after: int | None = None


async def require_task_row_or_lookup(db: Database, task_id: str) -> dict[str, Any]:
    """Service-layer alias: missing task → ``LookupError`` (routes map to 404)."""
    return await require_task_row(db, task_id, missing=LookupError)


def validate_agent_prompt(*, effective_mode: str, prompt: str) -> None:
    if effective_mode != AGENT_MODE:
        return
    if not prompt.strip():
        raise TaskWriteError(
            "agent tasks require a non-empty promptTemplate (goals / search / extraction rules for the Agent)"
        )


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
        raise TaskWriteError(f"{label} must be between {minimum} and {maximum}")


def task_emoji_from_body(body: TaskConfigBody, *, existing: dict[str, Any] | None) -> str | None:
    """Create: omitted → NULL. Update: omitted → keep existing. Empty string clears."""
    if "emoji" not in body.model_fields_set:
        return emoji_from_row(existing) if existing is not None else None
    try:
        return normalize_optional_emoji(body.emoji)
    except EmojiValidationError as exc:
        raise TaskWriteError(str(exc)) from exc


def validate_task_config_body(body: TaskConfigBody) -> None:
    """HTTP-agnostic TaskConfigBody checks; raises ``TaskWriteError`` (routes map to 422)."""
    if not body.name.strip():
        raise TaskWriteError("Task name is required")
    if body.analysisMode is not None and body.analysisMode not in ALL_ANALYSIS_MODES:
        raise TaskWriteError(f"Invalid analysisMode: {body.analysisMode}")
    if body.analysisTimeRange is not None and body.analysisTimeRange not in ALLOWED_ANALYSIS_TIME_RANGES:
        raise TaskWriteError(f"Invalid analysisTimeRange: {body.analysisTimeRange}")
    if body.scheduleRrule is not None:
        try:
            resolve_trigger_rrule(
                analysis_mode=body.analysisMode,
                schedule_rrule=body.scheduleRrule,
            )
        except (ScheduleValidationError, ValueError, TypeError) as exc:
            raise TaskWriteError(str(exc)) from exc
    if body.analysisStrategyMode is not None and body.analysisStrategyMode not in ALLOWED_STRATEGY_MODES:
        raise TaskWriteError(f"Invalid analysisStrategyMode: {body.analysisStrategyMode}")
    _validate_optional_int_in_range(
        "agentWaveIntervalSeconds",
        body.agentWaveIntervalSeconds,
        minimum=AGENT_WAVE_INTERVAL_MIN,
        maximum=AGENT_WAVE_INTERVAL_MAX,
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


__all__ = [
    "TaskMutationResult",
    "require_task_row_or_lookup",
    "validate_agent_prompt",
    "validate_task_config_body",
    "task_emoji_from_body",
]

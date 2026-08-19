"""HTTP-agnostic task write policy (modes, workset ownership, agent caps).

Routes catch ``TaskWriteError`` and map to 422.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from server.api.schemas.requests import TaskConfigBody
from server.domain.analysis_modes import ALL_ANALYSIS_MODES
from server.queries.tasks_queries import fetch_task_row, fetch_task_workset_id
from server.queries.worksets_queries import workset_exists
from server.services.task_writes import TaskWriteError
from server.worksets_const import SYSTEM_WORKSET_ID

ALLOWED_MODES = ALL_ANALYSIS_MODES


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
    """Normalize agent policy for INSERT/UPDATE.

    Non-agent modes persist only ``output_analysis_events``. Create defaults:
    ``intel_event`` ON, ``leaderboard`` OFF (排行榜 still persists topics).
    Other agent-policy columns keep INSERT/UPDATE Python defaults
    (matching DDL); this helper does not construct an inert AgentTaskSpec.
    """
    from server.domain.agent_task_spec import (
        AgentTaskSpecError,
        agent_spec_to_db_kwargs,
        normalize_agent_task_spec,
    )
    from server.domain.analysis_modes import AGENT_MODE, LEADERBOARD_MODE

    if effective_mode != AGENT_MODE:
        fields = body.model_fields_set
        existing = existing or {}
        if "outputAnalysisEvents" in fields and body.outputAnalysisEvents is not None:
            out_ae = bool(body.outputAnalysisEvents)
        elif existing:
            raw = existing.get("output_analysis_events", 1)
            out_ae = bool(int(raw if raw is not None else 1))
        else:
            out_ae = effective_mode != LEADERBOARD_MODE
        return {"output_analysis_events": 1 if out_ae else 0}

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
) -> str:
    """Normalize workset ownership (always a real workset id).

    - Explicit ``worksetId`` (including null/empty → ``__general__``) when in
      ``fields_set`` or when ``fields_set`` is None (create path).
    - Else inherit from the parent task when creating a child without an explicit value.
    - Else keep ``existing`` on update, falling back to ``__general__``.
    """
    explicit = fields_set is None or "worksetId" in fields_set
    if explicit:
        if supplied is None or not str(supplied).strip():
            return SYSTEM_WORKSET_ID
        workset_id = str(supplied).strip()
        if not await workset_exists(db, workset_id):
            raise TaskWriteError(f"Unknown worksetId: {workset_id}")
        return workset_id

    if inherit_from_parent_id:
        parent_workset_id = await fetch_task_workset_id(db, inherit_from_parent_id)
        if parent_workset_id:
            return parent_workset_id

    if existing and str(existing).strip():
        return str(existing).strip()
    return SYSTEM_WORKSET_ID


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

"""Agent task configuration: trigger / capabilities / outputs.

Single SoT for ``analysis_mode=agent`` policy fields persisted on
``analysis_tasks`` and validated on save + scheduler entry.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final, Literal, Mapping

TriggerMode = Literal["schedule", "message_cursor", "message_threshold"]
AgentPresetId = Literal["project_reconcile", "web_scout"]

TRIGGER_SCHEDULE: Final = "schedule"
TRIGGER_MESSAGE_CURSOR: Final = "message_cursor"
TRIGGER_MESSAGE_THRESHOLD: Final = "message_threshold"

ALL_TRIGGER_MODES: Final[tuple[TriggerMode, ...]] = (
    TRIGGER_SCHEDULE,
    TRIGGER_MESSAGE_CURSOR,
    TRIGGER_MESSAGE_THRESHOLD,
)

PRESET_PROJECT_RECONCILE: Final = "project_reconcile"
PRESET_WEB_SCOUT: Final = "web_scout"


class AgentTaskSpecError(ValueError):
    """Invalid agent task configuration (save / scheduler)."""


@dataclass(frozen=True, slots=True)
class AgentTaskSpec:
    """Declarative policy for one ``analysis_mode=agent`` task."""

    trigger_mode: TriggerMode
    cap_calendar_read: bool = True
    cap_calendar_writes: bool = False
    cap_web_search: bool = False
    cap_force_web_search: bool = False
    cap_read_analysis_events: bool = True
    cap_read_items: bool = True
    output_calendar: bool = False
    output_analysis_events: bool = False

    def user_event_origin(self) -> str:
        """Provenance for calendar tool writes (DDL-safe ``user_events.origin``).

        Agent calendar writes always use ``agent``. Analysis-only tasks never
        enable calendar writes, so this value is unused on that path; findings
        go to ``analysis_events`` (no ``origin`` column).
        """
        return "agent"


def normalize_agent_task_spec(
    *,
    trigger_mode: str | None,
    cap_calendar_read: bool | int | None = True,
    cap_calendar_writes: bool | int | None = False,
    cap_web_search: bool | int | None = False,
    cap_force_web_search: bool | int | None = False,
    cap_read_analysis_events: bool | int | None = True,
    cap_read_items: bool | int | None = True,
    output_calendar: bool | int | None = False,
    output_analysis_events: bool | int | None = False,
    has_channels: bool | None = None,
) -> AgentTaskSpec:
    """Apply auto-corrections and validate; raise ``AgentTaskSpecError`` if illegal."""
    mode = str(trigger_mode or TRIGGER_SCHEDULE).strip()
    if mode not in ALL_TRIGGER_MODES:
        raise AgentTaskSpecError(f"Invalid trigger_mode: {trigger_mode!r}")

    cal_read = _as_bool(cap_calendar_read, default=True)
    cal_writes = _as_bool(cap_calendar_writes, default=False)
    web_search = _as_bool(cap_web_search, default=False)
    force_search = _as_bool(cap_force_web_search, default=False)
    read_ae = _as_bool(cap_read_analysis_events, default=True)
    read_items = _as_bool(cap_read_items, default=True)
    out_cal = _as_bool(output_calendar, default=False)
    out_ae = _as_bool(output_analysis_events, default=False)

    # Rule 2/3: calendar output ↔ calendar writes.
    if out_cal:
        cal_writes = True
    else:
        cal_writes = False

    # Merged UX: web search on ⇒ force-enabled for agent ticks (either flag implies both).
    web_search = web_search or force_search
    force_search = web_search

    # Rule 6: message_threshold without channels → schedule.
    if mode == TRIGGER_MESSAGE_THRESHOLD and has_channels is False:
        mode = TRIGGER_SCHEDULE

    if not out_cal and not out_ae:
        raise AgentTaskSpecError("Agent tasks require at least one output: outputCalendar or outputAnalysisEvents")

    # Cursor drain is calendar-reconcile only; analysis-event output uses schedule/threshold.
    if mode == TRIGGER_MESSAGE_CURSOR and out_ae:
        raise AgentTaskSpecError("triggerMode=message_cursor cannot be combined with outputAnalysisEvents")

    # Rule 5: message_cursor requires channels when known at save time.
    if mode == TRIGGER_MESSAGE_CURSOR and has_channels is False:
        raise AgentTaskSpecError("triggerMode=message_cursor requires at least one bound channel")

    return AgentTaskSpec(
        trigger_mode=mode,  # type: ignore[arg-type]
        cap_calendar_read=cal_read,
        cap_calendar_writes=cal_writes,
        cap_web_search=web_search,
        cap_force_web_search=force_search,
        cap_read_analysis_events=read_ae,
        cap_read_items=read_items,
        output_calendar=out_cal,
        output_analysis_events=out_ae,
    )


def agent_preset_spec(preset: AgentPresetId | str, *, has_channels: bool = False) -> AgentTaskSpec:
    """Build a normalized spec from a named UI preset."""
    if preset == PRESET_PROJECT_RECONCILE:
        return normalize_agent_task_spec(
            trigger_mode=TRIGGER_MESSAGE_CURSOR,
            cap_calendar_read=True,
            cap_calendar_writes=True,
            cap_web_search=False,
            cap_force_web_search=False,
            cap_read_analysis_events=True,
            cap_read_items=True,
            output_calendar=True,
            output_analysis_events=False,
            has_channels=True if has_channels else None,
        )
    if preset == PRESET_WEB_SCOUT:
        trigger = TRIGGER_MESSAGE_THRESHOLD if has_channels else TRIGGER_SCHEDULE
        return normalize_agent_task_spec(
            trigger_mode=trigger,
            cap_calendar_read=True,
            cap_calendar_writes=False,
            cap_web_search=True,
            cap_force_web_search=True,
            cap_read_analysis_events=True,
            cap_read_items=True,
            output_calendar=False,
            output_analysis_events=True,
            has_channels=has_channels,
        )
    raise AgentTaskSpecError(f"Unknown agent preset: {preset!r}")


def agent_task_spec_from_row(
    row: Mapping[str, Any],
    *,
    has_channels: bool | None = None,
) -> AgentTaskSpec:
    """Load + normalize policy from an ``analysis_tasks`` row."""
    return normalize_agent_task_spec(
        trigger_mode=str(row.get("trigger_mode") or TRIGGER_SCHEDULE),
        cap_calendar_read=row.get("cap_calendar_read"),
        cap_calendar_writes=row.get("cap_calendar_writes"),
        cap_web_search=row.get("cap_web_search"),
        cap_force_web_search=row.get("cap_force_web_search"),
        cap_read_analysis_events=row.get("cap_read_analysis_events"),
        cap_read_items=row.get("cap_read_items"),
        output_calendar=row.get("output_calendar"),
        output_analysis_events=row.get("output_analysis_events"),
        has_channels=has_channels,
    )


def agent_spec_to_db_kwargs(spec: AgentTaskSpec) -> dict[str, Any]:
    """Map a normalized spec to INSERT/UPDATE column kwargs."""
    return {
        "trigger_mode": spec.trigger_mode,
        "cap_calendar_read": 1 if spec.cap_calendar_read else 0,
        "cap_calendar_writes": 1 if spec.cap_calendar_writes else 0,
        "cap_web_search": 1 if spec.cap_web_search else 0,
        "cap_force_web_search": 1 if spec.cap_force_web_search else 0,
        "cap_read_analysis_events": 1 if spec.cap_read_analysis_events else 0,
        "cap_read_items": 1 if spec.cap_read_items else 0,
        "output_calendar": 1 if spec.output_calendar else 0,
        "output_analysis_events": 1 if spec.output_analysis_events else 0,
    }


def _as_bool(value: bool | int | None, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return bool(int(value))

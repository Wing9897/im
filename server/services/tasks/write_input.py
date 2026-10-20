"""HTTP-agnostic task write payload.

Field names match ``TaskConfigBody``. This is a plain data carrier, not an
OpenAPI / Pydantic model: routes parse the wire body, then copy values here.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field, fields
from typing import Any

from server.domain.agent_task_spec import TriggerMode
from server.domain.analysis_modes import AnalysisMode
from server.domain.analysis_strategy_modes import AnalysisStrategyMode
from server.domain.notify_prefs import NotifyPref


@dataclass
class TaskWriteInput:
    """Values a task create/update may persist, plus which keys the caller set."""

    name: str
    description: str | None = None
    promptTemplate: str = ""
    analysisMode: AnalysisMode | None = None
    analysisTimeRange: str | None = None
    channelIds: list[str | dict[str, Any]] | None = None
    scheduleRrule: str | None = None
    includeInTimeline: bool | None = None
    isActive: bool | None = None
    agentWaveIntervalSeconds: int | None = None
    batchOverlapCount: int | None = None
    analysisTriggerThreshold: int | None = None
    analysisBatchMessageLimit: int | None = None
    analysisStrategyMode: AnalysisStrategyMode | None = None
    worksetId: str | None = None
    triggerMode: TriggerMode | None = None
    capCalendarRead: bool | None = None
    capCalendarWrites: bool | None = None
    capWebSearch: bool | None = None
    capForceWebSearch: bool | None = None
    capReadAnalysisEvents: bool | None = None
    capReadItems: bool | None = None
    outputCalendar: bool | None = None
    outputAnalysisEvents: bool | None = None
    llmProfileId: str | None = None
    notifyPref: NotifyPref | None = None
    emoji: str | None = None
    fields_set: frozenset[str] = field(default_factory=frozenset)

    @property
    def model_fields_set(self) -> set[str]:
        """Same role as Pydantic ``model_fields_set``: keys the caller supplied."""
        return set(self.fields_set)

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any], fields_set: Iterable[str]) -> TaskWriteInput:
        names = {item.name for item in fields(cls) if item.name != "fields_set"}
        values = {name: payload[name] for name in names if name in payload}
        return cls(fields_set=frozenset(fields_set), **values)

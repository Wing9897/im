"""Task create/update and schedule request models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from server.domain.agent_task_spec import TriggerMode
from server.domain.analysis_modes import AnalysisMode
from server.domain.analysis_strategy_modes import AnalysisStrategyMode
from server.api.schemas.notify_pref import CoercedNotifyPref
from server.scheduler.task_schedule_overrides import (
    AGENT_WAVE_INTERVAL_MAX,
    AGENT_WAVE_INTERVAL_MIN,
    ANALYSIS_BATCH_LIMIT_MAX,
    ANALYSIS_BATCH_LIMIT_MIN,
    ANALYSIS_THRESHOLD_MAX,
    ANALYSIS_THRESHOLD_MIN,
    BATCH_OVERLAP_MAX,
    BATCH_OVERLAP_MIN,
)


class TaskConfigBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str | None = None
    promptTemplate: str = ""
    analysisMode: AnalysisMode | None = None
    analysisTimeRange: str | None = None
    channelIds: list[str | dict[str, Any]] | None = None
    scheduleRrule: str | None = Field(
        default=None,
        description=(
            "Canonical trigger-purpose RRULE for AI modes (APScheduler next-run only). "
            "Never calendar-expanded. Sole create/update schedule write SoT on the HTTP wire."
        ),
    )
    includeInTimeline: bool | None = None
    isActive: bool | None = None
    agentWaveIntervalSeconds: int | None = Field(default=None, ge=AGENT_WAVE_INTERVAL_MIN, le=AGENT_WAVE_INTERVAL_MAX)
    batchOverlapCount: int | None = Field(default=None, ge=BATCH_OVERLAP_MIN, le=BATCH_OVERLAP_MAX)
    analysisTriggerThreshold: int | None = Field(default=None, ge=ANALYSIS_THRESHOLD_MIN, le=ANALYSIS_THRESHOLD_MAX)
    analysisBatchMessageLimit: int | None = Field(
        default=None, ge=ANALYSIS_BATCH_LIMIT_MIN, le=ANALYSIS_BATCH_LIMIT_MAX
    )
    analysisStrategyMode: AnalysisStrategyMode | None = None
    worksetId: str | None = Field(
        default=None,
        description="Ownership workset. Omitted / null / empty on create or update → builtin 一般 (`__general__`).",
    )
    #: Agent-mode policy (ignored unless analysisMode=agent).
    triggerMode: TriggerMode | None = None
    capCalendarRead: bool | None = None
    capCalendarWrites: bool | None = None
    capWebSearch: bool | None = None
    capForceWebSearch: bool | None = None
    capReadAnalysisEvents: bool | None = None
    capReadItems: bool | None = None
    outputCalendar: bool | None = None
    outputAnalysisEvents: bool | None = Field(
        default=None,
        description=(
            "Intelligence-page hard gate (analysis_events). When false, intel_event / agent "
            "batches skip persisting analysis_events. Leaderboard never writes analysis_events; "
            "omitted on create defaults to false for leaderboard and true for intel_event. "
            "Leaderboard still persists trending_topics for the leaderboard page. "
            "Agent still requires at least one of outputCalendar or outputAnalysisEvents; "
            "triggerMode=message_cursor cannot enable this flag."
        ),
    )
    #: LLM profile id. Omitted / null on create → oldest complete profile (else 400).
    llmProfileId: str | None = None
    #: Per-task reminder; omitted / null → ``inherit`` on create, keep existing on update.
    notifyPref: CoercedNotifyPref | None = None

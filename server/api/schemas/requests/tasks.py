"""Task create/update and schedule request models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from server.domain.analysis_modes import AnalysisMode
from server.scheduler.task_schedule_overrides import (
    ANALYSIS_BATCH_LIMIT_MAX,
    ANALYSIS_BATCH_LIMIT_MIN,
    ANALYSIS_THRESHOLD_MAX,
    ANALYSIS_THRESHOLD_MIN,
    BATCH_OVERLAP_MAX,
    BATCH_OVERLAP_MIN,
    PROJECT_WAVE_INTERVAL_MAX,
    PROJECT_WAVE_INTERVAL_MIN,
)


class TaskConfigBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str | None = None
    promptTemplate: str = ""
    webSearchQuery: str | None = None
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
    projectWaveIntervalSeconds: int | None = Field(
        default=None, ge=PROJECT_WAVE_INTERVAL_MIN, le=PROJECT_WAVE_INTERVAL_MAX
    )
    batchOverlapCount: int | None = Field(default=None, ge=BATCH_OVERLAP_MIN, le=BATCH_OVERLAP_MAX)
    analysisTriggerThreshold: int | None = Field(default=None, ge=ANALYSIS_THRESHOLD_MIN, le=ANALYSIS_THRESHOLD_MAX)
    analysisBatchMessageLimit: int | None = Field(
        default=None, ge=ANALYSIS_BATCH_LIMIT_MIN, le=ANALYSIS_BATCH_LIMIT_MAX
    )
    analysisStrategyMode: str | None = None
    worksetId: str | None = None


class CreateRecurringTaskBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    rrule: str
    eventStartTime: str | None = None
    eventEndTime: str | None = None
    eventIsAllDay: bool = False
    eventLocation: str | None = None
    eventDescription: str | None = None
    description: str | None = None
    worksetId: str | None = None
    parentTaskId: str | None = Field(
        default=None,
        description="Optional project parent for nested recurring children",
    )


class TaskScheduleBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rrule: str
    eventStartTime: str | None = None
    eventEndTime: str | None = None
    eventIsAllDay: bool = False
    eventLocation: str | None = None
    eventDescription: str | None = None
    parentTaskId: str | None = Field(
        default=None,
        description="Optional project parent for nested recurring children",
    )

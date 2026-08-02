"""Task CRUD, assistant/agent chat, and analysis-queue response models."""

from __future__ import annotations

from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field

from server.domain.analysis_modes import AnalysisMode


class TaskDraftPayload(BaseModel):
    """Wire shape for chat-assistant ``currentTask`` / ``taskConfig``.

    Aligned with ``web/src/domain/tasks/taskFormUtils.buildCurrentTaskPayload``.
    Extra AI keys are ignored so OpenAPI stays a concrete object (not unknown).
    """

    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    description: str | None = None
    promptTemplate: str | None = None
    scheduleType: str | None = None
    scheduleValue: str | None = None
    scheduleRrule: str | None = None
    analysisMode: AnalysisMode | None = None
    analysisTimeRange: str | None = None
    channelIds: list[Union[str, dict[str, Any]]] | None = None
    #: Event-mode time-planning visibility; omitted / null = leave form unchanged.
    includeInTimeline: bool | None = None


class ChatAssistantResponse(BaseModel):
    message: str
    taskConfig: TaskDraftPayload | None


class AgentToolCallSummary(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    resultSummary: str = ""


class AgentChatResponse(BaseModel):
    """Agent chat final payload (non-stream and stream ``type=final``)."""

    model_config = ConfigDict(extra="ignore")

    type: Literal["final"] | None = None
    message: str
    sessionId: str | None = None
    toolCalls: list[AgentToolCallSummary] = Field(default_factory=list)
    error: str | None = None
    #: Present when the task-editor advisor returned a non-empty config this turn.
    taskConfig: TaskDraftPayload | None = None


class ChannelRefResponse(BaseModel):
    platform: str
    platformId: str
    id: str


class TaskResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    promptTemplate: str = ""
    analysisMode: AnalysisMode
    analysisTimeRange: str
    version: int
    isActive: bool
    scheduleRrule: str | None = None
    scheduleType: str | None = None
    scheduleValue: str | None = None
    includeInTimeline: bool = True
    parentTaskId: str | None = None
    worksetId: str | None = None
    projectWaveIntervalSeconds: int | None = None
    batchOverlapCount: int | None = None
    analysisTriggerThreshold: int | None = None
    analysisBatchMessageLimit: int | None = None
    analysisStrategyMode: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None
    channelIds: list[ChannelRefResponse] | None = None
    deletedBatchCount: int | None = None


class TaskScheduleResponse(BaseModel):
    """Recurring calendar plan for ``analysisMode=recurring`` tasks."""

    taskId: str
    rrule: str
    eventStartTime: str | None = None
    eventEndTime: str | None = None
    eventIsAllDay: bool = False
    eventLocation: str | None = None
    eventDescription: str | None = None
    eventTimezone: str | None = None
    eventStartLocal: str | None = None
    eventEndLocal: str | None = None
    eventExdates: list[str] = Field(default_factory=list)
    eventRdates: list[str] = Field(default_factory=list)
    icsUid: str | None = None
    icsSource: str | None = None
    parentTaskId: str | None = None


class TaskDeleteResponse(BaseModel):
    taskId: str
    deletedBatchCount: int


class TaskActivitySpanResponse(BaseModel):
    #: Analysis-task id when ``sourceKind=task``; ``null`` on workset ownership rows.
    taskId: str | None = None
    taskName: str
    description: str | None = None
    analysisTimeRange: str
    isActive: bool
    earliestBatchStart: str | None = None
    latestBatchEnd: str | None = None
    completedBatchCount: int
    #: Latest completed batch agent message (project tick); null when unset.
    lastAgentMessage: str | None = None
    #: Latest completed batch tool-call summaries (empty when none).
    lastToolCalls: list[AgentToolCallSummary] = Field(default_factory=list)
    #: Latest completed batch error (failed project tick); null on success/skip.
    lastErrorMessage: str | None = None
    #: Messages drained in the latest completed tick (0 when skipped).
    lastMessageCount: int | None = None
    #: ``task`` = analysis_tasks row; ``workset`` = user_events ownership span
    #: (one row per workset_id; prefer ``worksetId`` + ``sourceKind``).
    sourceKind: Literal["task", "workset"] = "task"
    #: Ownership workset id when ``sourceKind=workset`` (authoritative row key);
    #: ``null`` on analysis-task rows.
    worksetId: str | None = None


class ProjectTickLogEntryResponse(BaseModel):
    batchId: str
    status: str
    #: success | skipped | error
    outcome: str
    messageCount: int
    agentMessage: str | None = None
    errorMessage: str | None = None
    toolCalls: list[AgentToolCallSummary] = Field(default_factory=list)
    createdAt: str | None = None
    completedAt: str | None = None


class ProjectTickInFlightResponse(BaseModel):
    """Current schedule-fire batch still pending/processing (waves in progress)."""

    batchId: str
    status: str
    messageCount: int
    createdAt: str | None = None
    updatedAt: str | None = None


class ProjectTickStatusResponse(BaseModel):
    taskId: str
    cursorAt: str | None = None
    pendingSinceCursor: int
    ticks: list[ProjectTickLogEntryResponse] = Field(default_factory=list)
    #: Non-null while a drain fire has not yet completed (wave progress via messageCount).
    inFlight: ProjectTickInFlightResponse | None = None


class QueueBatchResponse(BaseModel):
    batchId: str
    taskId: str
    taskName: str
    messageCount: int
    status: str
    retryCount: int
    errorMessage: str | None = None
    promptTokens: int
    completionTokens: int
    createdAt: str | None = None
    updatedAt: str | None = None


class ResultsQueueResponse(BaseModel):
    pendingCount: int
    processingBatches: list[QueueBatchResponse]
    attentionBatches: list[QueueBatchResponse]
    analysisPaused: bool


class TaskAnalysisStatsResponse(BaseModel):
    taskId: str
    analyzedCount: int
    unanalyzedCount: int
    queuedMessageCount: int

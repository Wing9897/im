"""UI-preference envelopes and PUT bodies (OpenAPI SoT for web/src/api/uiPrefs)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from server.worksets_const import SYSTEM_WORKSET_ID

BoardGanttViewMode = Literal["day", "month"]
TimelineEventStatus = Literal["pending", "confirmed", "completed"]
AssistantMessageRole = Literal["user", "assistant"]
NotifyHistoryStatus = Literal["success", "failure"]
SpacePttMode = Literal["hold", "toggle"]


class SourceFilterSelectionSchema(BaseModel):
    """Hierarchical source multi-select (``null`` at parent = all sources)."""

    model_config = ConfigDict(extra="forbid")

    taskIds: list[str] = Field(default_factory=list)
    worksetIds: list[str] = Field(default_factory=list)


class BoardMapViewSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    center: list[float] = Field(min_length=2, max_length=2)
    zoom: float


class BoardWidgetSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    i: str
    type: str
    col: int
    row: int
    sizeId: str
    z: int | None = None


class BoardLayoutSchema(BaseModel):
    """Layout blob stored under ``ops_board_layout`` (v16 widgets mosaic)."""

    model_config = ConfigDict(extra="forbid")

    version: int
    widgets: list[BoardWidgetSchema]


class BoardWidgetStateSchema(BaseModel):
    """Per-widget map / source-filter / gantt zoom state."""

    model_config = ConfigDict(extra="forbid")

    mapViews: dict[str, BoardMapViewSchema]
    sourceFilters: dict[str, SourceFilterSelectionSchema | None]
    ganttViewModes: dict[str, BoardGanttViewMode]


class BoardPrefsResponse(BaseModel):
    configured: bool
    layout: BoardLayoutSchema | None = None
    widgetState: BoardWidgetStateSchema | None = None


class BoardPrefsPutBody(BaseModel):
    """Partial board upsert. Omit a key to leave unchanged; ``null`` clears it."""

    model_config = ConfigDict(extra="forbid")

    layout: BoardLayoutSchema | None = None
    widgetState: BoardWidgetStateSchema | None = None


class NotifyQuietHoursSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    start: str = "22:00"
    end: str = "07:00"


class NotifySettingsSchema(BaseModel):
    """Local-notify settings blob under ``notify_settings``."""

    # ignore unknown keys; avoid OpenAPI additionalProperties index signature
    # that breaks FE assignability.
    model_config = ConfigDict(extra="ignore")

    enabled: bool = False
    voiceEnabled: bool = True
    flashEnabled: bool = True
    flashMode: Literal["timed", "persistent"] = "timed"
    leadOffsetsMinutes: list[int] = Field(default_factory=lambda: [60])
    preambleChimeId: str = "broadcast"
    quietHours: NotifyQuietHoursSchema | None = None


class NotifySettingsResponse(BaseModel):
    configured: bool
    settings: NotifySettingsSchema | None = None


class NotifySettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    settings: NotifySettingsSchema


class NotifyFiredResponse(BaseModel):
    configured: bool
    keys: list[str] | None = None


class NotifyFiredBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    keys: list[str]


class NotifyFiredClaimResponse(BaseModel):
    configured: bool
    claimed: list[str] = Field(default_factory=list)
    keys: list[str] = Field(default_factory=list)


class NotifyHistoryEntrySchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    triggerReason: str
    status: NotifyHistoryStatus
    errorMessage: str | None = None
    triggeredAt: str
    eventId: str | None = None
    title: str | None = None
    leadOffsetMinutes: int | None = None


class NotifyHistoryResponse(BaseModel):
    configured: bool
    entries: list[NotifyHistoryEntrySchema] | None = None


class NotifyHistoryBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[NotifyHistoryEntrySchema]


class AssistantToolCallSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    resultSummary: str | None = None


class AssistantSessionMessageSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    role: AssistantMessageRole
    content: str
    toolCalls: list[AssistantToolCallSchema] | None = None


class AssistantSessionSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    updatedAt: int
    messages: list[AssistantSessionMessageSchema]
    sessionId: str | None = None
    #: When set, assistant chat for this session uses that complete profile.
    #: When unset: hard-bound global assistant slot.
    llmProfileId: str | None = None


class AssistantSessionsResponse(BaseModel):
    configured: bool
    sessions: list[AssistantSessionSchema] | None = None
    activeSessionId: str | None = None


class AssistantSessionsPutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deviceId: str
    sessions: list[AssistantSessionSchema]
    activeSessionId: str | None = None


class AssistantVoiceIoSettingsSchema(BaseModel):
    """Assistant STT/TTS IO defaults (incl. calendar create target workset)."""

    # ignore unknown keys; avoid OpenAPI additionalProperties index signature.
    model_config = ConfigDict(extra="ignore")

    sttProvider: str = "browser"
    ttsProvider: str = "browser"
    ttsEnabled: bool = True
    speechLanguage: str = "zh-HK"
    spacePttMode: SpacePttMode = "hold"
    ttsVoiceUri: str = ""
    defaultWorksetId: str = SYSTEM_WORKSET_ID


class AssistantVoiceIoResponse(BaseModel):
    configured: bool
    settings: AssistantVoiceIoSettingsSchema | None = None


class AssistantVoiceIoBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    settings: AssistantVoiceIoSettingsSchema


class TimelineEventTimeOverrideSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    startTime: str
    endTime: str | None


class TimelineAnnotationsResponse(BaseModel):
    configured: bool
    eventStatuses: dict[str, TimelineEventStatus] | None = None
    eventTimeOverrides: dict[str, TimelineEventTimeOverrideSchema] | None = None


class TimelineAnnotationsPutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    eventStatuses: dict[str, TimelineEventStatus]
    eventTimeOverrides: dict[str, TimelineEventTimeOverrideSchema]


class ScheduleEmojisResponse(BaseModel):
    """Per-schedule-item emoji glyphs stored under ``schedule_emojis``."""

    configured: bool
    emojis: dict[str, str] | None = None


class ScheduleEmojisPutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    emojis: dict[str, str]


class TaskEmojisResponse(BaseModel):
    """Per-analysis-task emoji glyphs stored under ``task_emojis`` (not a DB column)."""

    configured: bool
    emojis: dict[str, str] | None = None


class TaskEmojisPutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    emojis: dict[str, str]

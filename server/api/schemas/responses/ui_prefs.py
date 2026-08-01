"""UI-preference envelopes.

Board layout / widgetState stay loose JSON. Voice reminder and assistant voice-IO
settings document structured fields (``sourceFilter``, ``defaultWorksetId``) while
still allowing extra keys so sanitize paths keep working.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from server.worksets_const import SYSTEM_WORKSET_ID


class BoardPrefsResponse(BaseModel):
    configured: bool
    layout: dict[str, Any] | None = None
    widgetState: dict[str, Any] | None = None


class SourceFilterSelectionSchema(BaseModel):
    """Hierarchical source multi-select (``null`` at parent = all sources)."""

    model_config = ConfigDict(extra="forbid")

    taskIds: list[str] = Field(default_factory=list)
    worksetIds: list[str] = Field(default_factory=list)


class VoiceQuietHoursSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    start: str = "22:00"
    end: str = "07:00"


class VoiceReminderSettingsSchema(BaseModel):
    """Voice reminder settings blob under ``voice_reminder_settings``."""

    model_config = ConfigDict(extra="allow")

    enabled: bool = False
    leadOffsetsMinutes: list[int] = Field(default_factory=lambda: [60])
    sourceFilter: SourceFilterSelectionSchema | None = None
    preambleChimeId: str = "broadcast"
    quietHours: VoiceQuietHoursSchema | None = None


class VoiceReminderSettingsResponse(BaseModel):
    configured: bool
    settings: VoiceReminderSettingsSchema | None = None


class VoiceReminderFiredResponse(BaseModel):
    configured: bool
    keys: list[Any] | None = None


class VoiceReminderFiredClaimResponse(BaseModel):
    configured: bool
    claimed: list[Any] = Field(default_factory=list)
    keys: list[Any] = Field(default_factory=list)


class VoiceReminderHistoryResponse(BaseModel):
    configured: bool
    entries: list[Any] | None = None


class AssistantSessionsResponse(BaseModel):
    configured: bool
    sessions: list[Any] | None = None
    activeSessionId: str | None = None


class AssistantVoiceIoSettingsSchema(BaseModel):
    """Assistant STT/TTS IO defaults (incl. calendar create target workset)."""

    model_config = ConfigDict(extra="allow")

    sttProvider: str = "browser"
    ttsProvider: str = "browser"
    ttsEnabled: bool = True
    speechLanguage: str = "zh-HK"
    spacePttMode: str = "hold"
    ttsVoiceUri: str = ""
    defaultWorksetId: str = SYSTEM_WORKSET_ID


class AssistantVoiceIoResponse(BaseModel):
    configured: bool
    settings: AssistantVoiceIoSettingsSchema | None = None


class TimelineAnnotationsResponse(BaseModel):
    configured: bool
    eventStatuses: dict[str, Any] | None = None
    eventTimeOverrides: dict[str, Any] | None = None

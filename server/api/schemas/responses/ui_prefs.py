"""UI-preference envelopes.

Only the envelope is typed: the inner payloads stay loose JSON so the frontend
can evolve board layouts and voice settings without a server release.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class BoardPrefsResponse(BaseModel):
    configured: bool
    layout: dict[str, Any] | None = None
    widgetState: dict[str, Any] | None = None


class VoiceReminderSettingsResponse(BaseModel):
    configured: bool
    settings: dict[str, Any] | None = None


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


class AssistantVoiceIoResponse(BaseModel):
    configured: bool
    settings: dict[str, Any] | None = None


class TimelineAnnotationsResponse(BaseModel):
    configured: bool
    eventStatuses: dict[str, Any] | None = None
    eventTimeOverrides: dict[str, Any] | None = None

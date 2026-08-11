"""Response models for LLM profiles and staff instances."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LlmProviderWire = Literal["ollama", "openai_compatible", "gemini_compatible", "openrouter"]
StaffClassWire = Literal["leaderboard", "intel_event", "agent", "assistant"]


class LlmStaffInstanceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    staffClass: StaffClassWire | str
    profileId: str
    displayName: str | None = None
    isActive: bool = True
    createdAt: str | None = None
    updatedAt: str | None = None
    profileName: str | None = None
    profileProvider: str | None = None
    profileModel: str | None = None
    profileIsDefault: bool | None = None


class LlmProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    provider: LlmProviderWire | str
    baseUrl: str = ""
    model: str = ""
    apiKey: str = ""
    thinkingEnabled: bool = False
    jsonMode: str = "disabled"
    webSearchEnabled: bool = True
    webSearchProvider: str = "auto"
    braveSearchApiKey: str = ""
    isDefault: bool = False
    staffClasses: list[str] = Field(default_factory=list)
    staffInstances: list[LlmStaffInstanceResponse] = Field(default_factory=list)
    createdAt: str | None = None
    updatedAt: str | None = None


class LlmProfileDeleteResponse(BaseModel):
    ok: bool

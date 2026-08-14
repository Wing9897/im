"""Response models for LLM profiles and staff instances."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from server.domain.json_modes import JsonModeWire
from server.domain.llm_providers import LlmProviderWire
from server.domain.web_search_providers import WebSearchProviderWire
from server.llm_global_slots import LlmGlobalSlotId

StaffClassWire = Literal["leaderboard", "intel_event", "agent"]


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


class LlmProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    provider: LlmProviderWire | str
    baseUrl: str = ""
    model: str = ""
    apiKey: str = ""
    thinkingEnabled: bool = False
    jsonMode: JsonModeWire | str = "disabled"
    webSearchEnabled: bool = True
    webSearchProvider: WebSearchProviderWire | str = "auto"
    braveSearchApiKey: str = ""
    staffClasses: list[str] = Field(default_factory=list)
    staffInstances: list[LlmStaffInstanceResponse] = Field(default_factory=list)
    createdAt: str | None = None
    updatedAt: str | None = None


class LlmProfileDeleteResponse(BaseModel):
    ok: bool


class LlmGlobalSlotBindingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slot: LlmGlobalSlotId
    profileId: str | None = None
    profileName: str | None = None
    profileProvider: str | None = None
    profileModel: str | None = None


class LlmGlobalSlotsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slots: list[LlmGlobalSlotBindingResponse] = Field(default_factory=list)

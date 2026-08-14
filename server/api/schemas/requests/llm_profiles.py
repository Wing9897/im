"""Request models for LLM profiles."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from server.domain.json_modes import JsonModeWire
from server.domain.llm_providers import LlmProviderWire
from server.domain.web_search_providers import WebSearchProviderWire

#: Task-mode classes only on profile upsert (global slots are separate).
StaffClassWire = Literal["leaderboard", "intel_event", "agent"]


class LlmProfileUpsertBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    provider: LlmProviderWire = "ollama"
    baseUrl: str = ""
    model: str = ""
    apiKey: str | None = None
    thinkingEnabled: bool = False
    jsonMode: JsonModeWire = "disabled"
    webSearchEnabled: bool = True
    webSearchProvider: WebSearchProviderWire = "auto"
    braveSearchApiKey: str | None = None
    staffClasses: list[StaffClassWire] = Field(default_factory=list)


class LlmProfileCopyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)


class LlmGlobalSlotBindBody(BaseModel):
    """Bind or clear a singleton global slot (``profileId`` null/empty clears)."""

    model_config = ConfigDict(extra="forbid")

    profileId: str | None = None

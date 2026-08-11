"""Request models for LLM profiles."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LlmProviderWire = Literal["ollama", "openai_compatible", "gemini_compatible", "openrouter"]
StaffClassWire = Literal["leaderboard", "intel_event", "agent", "assistant"]
WebSearchProviderWire = Literal["auto", "duckduckgo", "brave"]


class LlmProfileUpsertBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    provider: LlmProviderWire = "ollama"
    baseUrl: str = ""
    model: str = ""
    apiKey: str | None = None
    thinkingEnabled: bool = False
    jsonMode: str = "disabled"
    webSearchEnabled: bool = True
    webSearchProvider: WebSearchProviderWire = "auto"
    braveSearchApiKey: str | None = None
    staffClasses: list[StaffClassWire] = Field(default_factory=list)
    isDefault: bool | None = None


class LlmProfileCopyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)

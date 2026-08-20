"""Request models for LLM profiles."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, create_model

from server.api.schemas.web_search_fields import web_search_secret_field_definitions
from server.domain.json_modes import JsonModeWire
from server.domain.llm_providers import LlmProviderWire
from server.domain.llm_staff_classes import LlmStaffClass
from server.domain.web_search_providers import WebSearchProviderWire

#: Task-mode classes only on profile upsert (global slots are separate).
StaffClassWire = LlmStaffClass


class _LlmProfileUpsertCore(BaseModel):
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


LlmProfileUpsertBody = create_model(
    "LlmProfileUpsertBody",
    __base__=_LlmProfileUpsertCore,
    __module__=__name__,
    **web_search_secret_field_definitions(optional=True),
    staffClasses=(list[StaffClassWire], Field(default_factory=list)),
)


class LlmProfileCopyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)


class LlmGlobalSlotBindBody(BaseModel):
    """Bind or clear a singleton global slot (``profileId`` null/empty clears)."""

    model_config = ConfigDict(extra="forbid")

    profileId: str | None = None

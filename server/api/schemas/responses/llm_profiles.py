"""Response models for LLM profiles and staff instances."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, create_model

from server.api.schemas.web_search_fields import web_search_secret_field_definitions
from server.domain.json_modes import JsonModeWire
from server.domain.llm_providers import LlmProviderWire
from server.domain.llm_staff_classes import LlmStaffClass
from server.domain.web_search_providers import WebSearchProviderWire
from server.llm_global_slots import LlmGlobalSlotId

StaffClassWire = LlmStaffClass


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


class _LlmProfileResponseCore(BaseModel):
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


if TYPE_CHECKING:

    class LlmProfileResponse(_LlmProfileResponseCore):
        staffClasses: list[str]
        staffInstances: list[LlmStaffInstanceResponse]
        createdAt: str | None
        updatedAt: str | None
else:
    LlmProfileResponse = create_model(
        "LlmProfileResponse",
        __base__=_LlmProfileResponseCore,
        __module__=__name__,
        **web_search_secret_field_definitions(optional=False),
        staffClasses=(list[str], Field(default_factory=list)),
        staffInstances=(list[LlmStaffInstanceResponse], Field(default_factory=list)),
        createdAt=(str | None, None),
        updatedAt=(str | None, None),
    )


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

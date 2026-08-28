"""Workset create and update request models."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

WORKSET_DESCRIPTION_MAX = 280
WORKSET_COVER_MAX_CHARS = 200 * 1024


class WorksetCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    #: Workset-level reminder default; omitted → on.
    notifyEnabled: bool = True
    #: MCP/A2A visibility; omitted → on.
    externalEnabled: bool = True
    description: str = Field(default="", max_length=WORKSET_DESCRIPTION_MAX)
    cover: str = Field(default="", max_length=WORKSET_COVER_MAX_CHARS)

    @field_validator("description", mode="before")
    @classmethod
    def _strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WorksetUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    notifyEnabled: bool | None = None
    externalEnabled: bool | None = None
    description: str | None = Field(default=None, max_length=WORKSET_DESCRIPTION_MAX)
    cover: str | None = Field(default=None, max_length=WORKSET_COVER_MAX_CHARS)

    @field_validator("description", mode="before")
    @classmethod
    def _strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

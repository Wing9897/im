"""Workset create and update request models."""

from pydantic import BaseModel, ConfigDict, Field


class WorksetCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    #: Workset-level reminder default; omitted → on.
    notifyEnabled: bool = True
    #: MCP/A2A visibility; omitted → on.
    externalEnabled: bool = True


class WorksetUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    notifyEnabled: bool | None = None
    externalEnabled: bool | None = None

"""Workset create and update request models."""

from pydantic import BaseModel, ConfigDict, Field


class WorksetCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)


class WorksetUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)

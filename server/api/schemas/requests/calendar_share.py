"""Request bodies for calendar-share proxy routes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from server.calendar_share.constants import PublicVisibility, canonicalize_listing_visibility


class CalendarShareLoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    baseUrl: str = Field(min_length=1, max_length=500)
    handle: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=200)


class CalendarShareGrantBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handle: str = Field(min_length=1, max_length=64)
    visibility: Literal["busy", "details"]


class CalendarSharePublishBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1, max_length=64)
    publicVisibility: PublicVisibility = "private_group"
    grants: list[CalendarShareGrantBody] = Field(default_factory=list)
    syncNow: bool = False

    @field_validator("publicVisibility", mode="before")
    @classmethod
    def _map_listing_visibility(cls, value: object) -> object:
        return canonicalize_listing_visibility(value)


class CalendarShareSubscribeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handle: str | None = Field(default=None, max_length=64)
    slug: str | None = Field(default=None, max_length=64)
    path: str | None = Field(default=None, max_length=140)


class CalendarShareTimezoneBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str = Field(min_length=1, max_length=64)

"""Request bodies for calendar-share proxy routes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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

    enabled: bool
    slug: str = Field(min_length=1, max_length=64)
    autoSync: bool = False
    publicVisibility: Literal["off", "busy", "details"] = "off"
    grants: list[CalendarShareGrantBody] = Field(default_factory=list)
    syncNow: bool = False


class CalendarShareSubscribeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handle: str | None = Field(default=None, max_length=64)
    slug: str | None = Field(default=None, max_length=64)
    path: str | None = Field(default=None, max_length=140)


class CalendarShareTimezoneBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str = Field(min_length=1, max_length=64)

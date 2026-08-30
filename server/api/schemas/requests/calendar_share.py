"""Request bodies for calendar-share proxy routes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from server.calendar_share.constants import PublicVisibility


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


class CalendarSharePublishAutoSyncBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    autoSync: bool | None = None
    autoSyncIntervalSeconds: int | None = None


class CalendarShareSubscribeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handle: str | None = Field(default=None, max_length=64)
    slug: str | None = Field(default=None, max_length=64)
    path: str | None = Field(default=None, max_length=140)


class CalendarShareTimezoneBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str = Field(min_length=1, max_length=64)


USER_AVATAR_MAX_CHARS = 200 * 1024


class CalendarShareProfileBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    avatar: str = Field(default="", max_length=USER_AVATAR_MAX_CHARS)

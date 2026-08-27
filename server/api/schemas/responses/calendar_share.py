"""Response models for calendar-share proxy routes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from server.calendar_share.constants import PublicVisibility


class CalendarShareGrantResponse(BaseModel):
    handle: str
    visibility: Literal["busy", "details"]


class CalendarShareSessionResponse(BaseModel):
    connected: bool
    baseUrl: str
    handle: str
    status: Literal["disconnected", "connected"]


class CalendarShareTimezoneResponse(BaseModel):
    timezone: str = ""
    suggestedTimezone: str = ""
    pendingPublicTimezone: bool = False
    lastPublicTimezone: str = ""


class CalendarSharePublishStateResponse(BaseModel):
    worksetId: str
    slug: str
    publicVisibility: PublicVisibility = "private_group"
    grants: list[CalendarShareGrantResponse] = Field(default_factory=list)
    lastSyncAt: str | None = None
    lastError: str | None = None
    pendingSync: bool = False
    isSystemWorkset: bool = False


class CalendarSharePublishListItemResponse(CalendarSharePublishStateResponse):
    """Local publish-map row plus whether the workset still exists."""

    worksetName: str = ""
    worksetMissing: bool = False
    emoji: str = ""
    description: str = ""


class CalendarSharePublishListResponse(BaseModel):
    items: list[CalendarSharePublishListItemResponse] = Field(default_factory=list)


class CalendarShareSubscriptionResponse(BaseModel):
    handle: str
    slug: str
    emoji: str = ""
    description: str = ""


class CalendarShareSubscriptionsResponse(BaseModel):
    items: list[CalendarShareSubscriptionResponse] = Field(default_factory=list)
    ownHandle: str = ""


class CalendarShareEventResponse(BaseModel):
    """Read-only subscribed occurrence. ``source`` is ``subscribed:{handle}/{slug}``."""

    id: str
    source: str
    title: str
    startTime: str | None = None
    endTime: str | None = None
    location: str | None = None
    isAllDay: bool = False
    timezone: str | None = None
    emoji: str | None = None
    taskId: str | None = None
    seriesId: str | None = None
    worksetId: str | None = None
    itemId: str | None = None
    origin: str | None = None
    itemDateKind: str | None = None
    notifyPref: str | None = None
    dismissed: bool = False
    important: bool = False
    taskName: str | None = None
    isLastOccurrence: bool = False
    remindBeforeDays: int | None = None
    body: str | None = None
    handle: str | None = None
    slug: str | None = None


class CalendarShareSubscriptionEventsResponse(BaseModel):
    items: list[CalendarShareEventResponse] = Field(default_factory=list)


class CalendarShareSearchHitResponse(BaseModel):
    handle: str
    slug: str
    hitKind: Literal["listing", "grant"]
    publicVisibility: PublicVisibility | None = None
    visibility: Literal["busy", "details"] | None = None
    emoji: str = ""
    description: str = ""


class CalendarShareSearchResponse(BaseModel):
    items: list[CalendarShareSearchHitResponse] = Field(default_factory=list)

"""User events, analysis-event pages, and timeline dismissals."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from server.api.schemas.notify_pref import CoercedNotifyPref
from server.domain.user_event_origins import UserEventOrigin


class UserEventResponse(BaseModel):
    id: str
    title: str
    body: str
    startTime: str
    endTime: str | None
    location: str | None
    origin: UserEventOrigin
    isAllDay: bool = False
    timezone: str | None = None
    icsUid: str | None = None
    icsSource: str | None = None
    #: Optional remind-N-days-before-start offset; null when unset.
    remindBeforeDays: int | None = None
    #: Analysis-task provenance id, or empty string when unset (NULL in DB).
    taskId: str = ""
    #: Optional parent inventory item; null when stand-alone (not an event sub-event).
    itemId: str | None = None
    #: Ownership workset id (builtin ``__general__`` for handwritten / assistant).
    worksetId: str
    #: Special linked-calendar semantics; title presets are UX only.
    kind: Literal["normal", "expires", "purchase_effective"] = "normal"
    #: Optional transaction amount for ``kind=purchase_effective`` only.
    amount: float | None = None
    #: ``expense`` (default when amount set) or ``income``; null when amount unset.
    direction: Literal["expense", "income"] | None = None
    #: Per-event reminder (``inherit`` / ``off``).
    notifyPref: CoercedNotifyPref = "inherit"
    emoji: str | None = None
    source: Literal["user"]
    dismissed: bool
    important: bool = False
    createdAt: str
    updatedAt: str


class UserEventsPageResponse(BaseModel):
    items: list[UserEventResponse]
    totalCount: int
    hasMore: bool


class RecurringSeriesResponse(BaseModel):
    """Standalone calendar recurring series (not an analysis task)."""

    id: str
    name: str
    description: str | None = None
    rrule: str
    eventStartTime: str | None = None
    eventEndTime: str | None = None
    eventIsAllDay: bool = False
    eventLocation: str | None = None
    eventDescription: str | None = None
    eventTimezone: str | None = None
    eventStartLocal: str | None = None
    eventEndLocal: str | None = None
    eventExdates: list[str] = Field(default_factory=list)
    eventRdates: list[str] = Field(default_factory=list)
    icsUid: str | None = None
    icsSource: str | None = None
    isActive: bool = True
    worksetId: str
    parentTaskId: str | None = None
    itemId: str | None = None
    #: Per-series reminder (``inherit`` / ``off``).
    notifyPref: CoercedNotifyPref = "inherit"
    emoji: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None


class RecurringSeriesPageResponse(BaseModel):
    items: list[RecurringSeriesResponse]
    totalCount: int
    hasMore: bool


class AnalysisEventResponse(BaseModel):
    id: str
    taskId: str
    version: int
    batchId: str
    title: str
    body: str
    startTime: str | None
    endTime: str | None
    location: str
    latitude: float | None
    longitude: float | None
    participants: list[str]
    sourceMessageId: str | None
    sourcePlatform: str | None
    sourceChannelName: str | None
    sourceMessageTime: str | None
    analysisTimeRange: str
    batchSourceChannelNames: list[str]
    taskName: str
    createdAt: str
    updatedAt: str
    dismissed: bool
    important: bool = False
    #: Parent analysis-task glyph (joined); NULL = product task logo.
    emoji: str | None = None


class AnalysisEventsPageResponse(BaseModel):
    items: list[AnalysisEventResponse]
    totalCount: int
    hasMore: bool
    sort: Literal["event_time", "analyzed_at"]


class TrendingTopicResponse(BaseModel):
    id: str
    taskId: str
    batchId: str
    rank: int
    topicName: str
    score: float
    summary: str | None
    taskName: str
    createdAt: str
    messageCount: int


class TimelineDismissalResponse(BaseModel):
    source: Literal["analysis", "user", "recurring", "item_remind"]
    eventId: str
    dismissedAt: str


class TimelineImportanceResponse(BaseModel):
    source: Literal["analysis", "user", "recurring", "item_remind"]
    eventId: str
    markedAt: str


class CalendarOccurrenceResponse(BaseModel):
    """RRULE occurrence or trackable-item DATE projection from ``GET /calendar/occurrences``."""

    id: str
    #: Recurring series id for ``source=recurring``; empty for item DATE projections.
    seriesId: str = ""
    taskName: str = ""
    title: str
    startTime: str
    endTime: str
    isAllDay: bool = False
    timezone: str | None = None
    location: str | None = None
    description: str | None = None
    rrule: str = ""
    dismissed: bool = False
    important: bool = False
    # True when this RRULE occurrence is the final one in a finite series (UNTIL/COUNT).
    isLastOccurrence: bool = False
    source: Literal["recurring", "item_remind"] = "recurring"
    worksetId: str | None = None
    itemId: str | None = None
    itemDateKind: Literal["remind"] | None = None
    #: Item remind projections inherit the linked expires calendar override.
    notifyPref: CoercedNotifyPref = "inherit"
    emoji: str | None = None


class CalendarWindowItemResponse(BaseModel):
    """Tagged occurrence from ``GET /calendar/window`` (timeline SoT)."""

    id: str
    source: Literal["analysis", "user", "recurring", "item_remind"]
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
    itemDateKind: Literal["remind"] | None = None
    notifyPref: CoercedNotifyPref | None = None
    dismissed: bool = False
    important: bool = False
    taskName: str | None = None
    isLastOccurrence: bool = False
    remindBeforeDays: int | None = None
    body: str | None = None


class CalendarWindowResponse(BaseModel):
    items: list[CalendarWindowItemResponse]
    limit: int
    cursor: str | None = None
    nextCursor: str | None = None


class CalendarHolidayItemResponse(BaseModel):
    """One Nager.Date public holiday (country-level, not city)."""

    date: str
    localName: str = ""
    name: str = ""
    countryCode: str
    isGlobal: bool = True
    types: list[str] = Field(default_factory=list)


class CalendarHolidaysResponse(BaseModel):
    """Public holidays for the household weather location's country."""

    year: int
    location: str
    country: str | None = None
    holidays: list[CalendarHolidayItemResponse] = Field(default_factory=list)


class CalendarImportWarningResponse(BaseModel):
    code: str
    message: str


class CalendarImportChangeResponse(BaseModel):
    field: str
    before: Any = None
    after: Any = None


class CalendarImportPreviewItemResponse(BaseModel):
    uid: str
    title: str
    targetType: Literal["user_event", "recurring"]
    action: Literal["create", "update", "unchanged", "unsupported"]
    supported: bool
    existingId: str | None
    fingerprint: str
    startTime: str
    endTime: str | None
    isAllDay: bool
    timezone: str | None
    rrule: str | None
    exdates: list[str]
    rdates: list[str]
    changes: list[CalendarImportChangeResponse]
    warnings: list[CalendarImportWarningResponse]


class CalendarImportPreviewResponse(BaseModel):
    sourceId: str
    calendarName: str | None
    eventCount: int
    importableCount: int
    items: list[CalendarImportPreviewItemResponse]
    warnings: list[CalendarImportWarningResponse]


class CalendarImportCommitItemResponse(BaseModel):
    uid: str
    targetType: Literal["user_event", "recurring"]
    targetId: str
    action: Literal["created", "updated", "unchanged"]


class CalendarImportCommitResponse(BaseModel):
    sourceId: str
    committedCount: int
    createdCount: int
    updatedCount: int
    unchangedCount: int
    results: list[CalendarImportCommitItemResponse]

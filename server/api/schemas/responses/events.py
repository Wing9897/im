"""User events, analysis-event pages, and timeline dismissals."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class UserEventResponse(BaseModel):
    id: str
    title: str
    body: str
    startTime: str
    endTime: str | None
    location: str | None
    origin: Literal["manual", "assistant", "a2a", "agent", "ics"]
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
    #: Ownership workset id (builtin ``__user__`` for handwritten / assistant).
    worksetId: str
    #: Special linked-calendar semantics; title presets are UX only.
    kind: Literal["normal", "expires", "purchase_effective"] = "normal"
    #: Optional transaction amount for ``kind=purchase_effective`` only.
    amount: float | None = None
    #: ``expense`` (default when amount set) or ``income``; null when amount unset.
    direction: Literal["expense", "income"] | None = None
    source: Literal["user"]
    dismissed: bool
    important: bool = False
    createdAt: str
    updatedAt: str


class UserEventsPageResponse(BaseModel):
    items: list[UserEventResponse]
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
    source: Literal["analysis", "user", "recurring", "item"]
    eventId: str
    dismissedAt: str


class TimelineImportanceResponse(BaseModel):
    source: Literal["analysis", "user", "recurring", "item"]
    eventId: str
    markedAt: str


class CalendarOccurrenceResponse(BaseModel):
    """RRULE occurrence or trackable-item DATE projection from ``GET /calendar/items``."""

    id: str
    taskId: str = ""
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
    source: Literal["recurring", "item"] = "recurring"
    worksetId: str | None = None
    itemId: str | None = None
    itemDateKind: Literal["remind"] | None = None


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
    targetType: Literal["user_event", "recurring_task"]
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
    targetType: Literal["user_event", "recurring_task"]
    targetId: str
    action: Literal["created", "updated", "unchanged"]


class CalendarImportCommitResponse(BaseModel):
    sourceId: str
    committedCount: int
    createdCount: int
    updatedCount: int
    unchangedCount: int
    results: list[CalendarImportCommitItemResponse]

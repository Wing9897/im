"""User events, analysis-event pages, and timeline dismissals."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class UserEventResponse(BaseModel):
    id: str
    title: str
    body: str
    startTime: str
    endTime: str | None
    location: str | None
    origin: Literal["manual", "assistant", "a2a", "project", "ics"]
    isAllDay: bool = False
    timezone: str | None = None
    icsUid: str | None = None
    icsSource: str | None = None
    #: Analysis-task provenance id, or empty string when unset (NULL in DB).
    taskId: str = ""
    #: Ownership workset id (builtin ``__user__`` for handwritten / assistant).
    worksetId: str
    source: Literal["user"]
    dismissed: bool
    createdAt: str
    updatedAt: str


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
    source: Literal["analysis", "user", "recurring"]
    eventId: str
    dismissedAt: str


class CalendarOccurrenceResponse(BaseModel):
    id: str
    taskId: str
    taskName: str
    title: str
    startTime: str
    endTime: str
    isAllDay: bool
    timezone: str | None = None
    location: str | None
    description: str | None
    rrule: str
    dismissed: bool

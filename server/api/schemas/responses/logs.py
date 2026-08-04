"""Application log response models."""

from __future__ import annotations

from pydantic import BaseModel


class AppLogCursorResponse(BaseModel):
    time: str
    id: str


class AppLogEntryResponse(BaseModel):
    id: str
    time: str
    level: str
    category: str
    kind: str
    message: str
    details: str | None


class AppLogPageResponse(BaseModel):
    logs: list[AppLogEntryResponse]
    nextCursor: AppLogCursorResponse | None
    hasMore: bool
    totalCount: int

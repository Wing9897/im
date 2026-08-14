"""Application log response models."""

from __future__ import annotations

from pydantic import BaseModel

from server.domain.app_log_categories import AppLogCategory
from server.domain.app_log_levels import AppLogLevel


class AppLogCursorResponse(BaseModel):
    time: str
    id: str


class AppLogEntryResponse(BaseModel):
    id: str
    time: str
    level: AppLogLevel
    category: AppLogCategory
    #: Free-form dotted event kind (``is_valid_log_kind`` shape gate, open set).
    kind: str
    message: str
    details: str | None


class AppLogPageResponse(BaseModel):
    logs: list[AppLogEntryResponse]
    nextCursor: AppLogCursorResponse | None
    hasMore: bool
    totalCount: int

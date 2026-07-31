"""Preview and atomically commit RFC 5545 calendar imports."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from server.api.deps import API_DEPS, get_db, publish_resource_modified
from server.calendar.ics import IcsParseError, normalize_ics_source
from server.calendar.imports import (
    CalendarImportError,
    ImportSelection,
    commit_calendar_import,
    preview_calendar_import,
)
from server.errors import VALIDATION_ERROR, http_error

router = APIRouter(prefix="/api/v1/calendar-imports", tags=["calendar-imports"], dependencies=API_DEPS)


class CalendarImportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str
    sourceId: str = "ics"


class CalendarImportSelectionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    uid: str
    fingerprint: str


class CalendarImportCommitBody(CalendarImportInput):
    selections: list[CalendarImportSelectionBody] = Field(min_length=1, max_length=2_000)


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


def _validation_error(exc: ValueError) -> HTTPException:
    return http_error(422, str(exc), error_code=VALIDATION_ERROR)


@router.post("/preview", response_model=CalendarImportPreviewResponse)
async def preview_import(request: Request, body: CalendarImportInput) -> CalendarImportPreviewResponse:
    try:
        source = normalize_ics_source(body.sourceId)
        result = await preview_calendar_import(get_db(request), content=body.content, source=source)
    except (IcsParseError, CalendarImportError) as exc:
        raise _validation_error(exc) from exc
    return CalendarImportPreviewResponse.model_validate(result)


@router.post("/commit", response_model=CalendarImportCommitResponse)
async def commit_import(request: Request, body: CalendarImportCommitBody) -> CalendarImportCommitResponse:
    try:
        source = normalize_ics_source(body.sourceId)
        selections = [
            ImportSelection(uid=selection.uid, fingerprint=selection.fingerprint) for selection in body.selections
        ]
        result = await commit_calendar_import(
            get_db(request),
            content=body.content,
            source=source,
            selections=selections,
        )
    except (IcsParseError, CalendarImportError) as exc:
        raise _validation_error(exc) from exc

    for item in result["results"]:
        if item["action"] == "unchanged":
            continue
        resource_type = "task" if item["targetType"] == "recurring_task" else "user_event"
        action = "created" if item["action"] == "created" else "updated"
        publish_resource_modified(request, resource_type, item["targetId"], action)
    return CalendarImportCommitResponse.model_validate(result)

"""Preview and atomically commit RFC 5545 calendar imports."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from server.api.deps import get_db, publish_resource_modified
from server.api.schemas.requests import CalendarImportCommitBody, CalendarImportInput
from server.api.schemas.responses import CalendarImportCommitResponse, CalendarImportPreviewResponse
from server.calendar.ics import IcsParseError, normalize_ics_source
from server.calendar.imports import (
    CalendarImportError,
    ImportSelection,
    commit_calendar_import,
    preview_calendar_import,
)
from server.errors import VALIDATION_ERROR, http_error

router = APIRouter(prefix="/imports", tags=["calendar"])


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
        resource_type = "recurring" if item["targetType"] == "recurring" else "user_event"
        action = "created" if item["action"] == "created" else "updated"
        publish_resource_modified(request, resource_type, item["targetId"], action)
    return CalendarImportCommitResponse.model_validate(result)

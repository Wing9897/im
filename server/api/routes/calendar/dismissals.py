"""Soft-remove / restore markers for timeline calendar UI."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel

from server.api.deps import get_db
from server.api.schemas.responses import TimelineDismissalResponse
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.timeline_dismissals import (
    TimelineDismissalValidationError,
    dismiss_timeline_event,
    list_timeline_dismissals,
    restore_timeline_event,
)

router = APIRouter(prefix="/dismissals", tags=["calendar"])


class TimelineDismissalBody(BaseModel):
    source: str
    eventId: str
    model_config = {"extra": "forbid"}


def _http_from_validation(exc: TimelineDismissalValidationError):
    return http_error(422, str(exc), error_code=VALIDATION_ERROR)


@router.get("", response_model=list[TimelineDismissalResponse])
async def list_dismissals(
    request: Request,
    source: str | None = None,
) -> list[dict]:
    db = get_db(request)
    try:
        return await list_timeline_dismissals(db, source=source)
    except TimelineDismissalValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.put("", response_model=TimelineDismissalResponse)
async def put_dismissal(request: Request, body: TimelineDismissalBody) -> dict:
    db = get_db(request)
    try:
        return await dismiss_timeline_event(db, source=body.source, event_id=body.eventId)
    except TimelineDismissalValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.delete("", status_code=204)
async def delete_dismissal(
    request: Request,
    source: str = Query(...),
    eventId: str = Query(...),
) -> Response:
    resolved = eventId.strip()
    if not resolved:
        raise http_error(
            422,
            "eventId is required",
            error_code=VALIDATION_ERROR,
        )
    db = get_db(request)
    try:
        restored = await restore_timeline_event(db, source=source, event_id=resolved)
    except TimelineDismissalValidationError as exc:
        raise _http_from_validation(exc) from exc
    if not restored:
        raise http_error(404, "Dismissal not found", error_code=NOT_FOUND)
    return Response(status_code=204)

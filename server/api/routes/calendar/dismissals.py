"""Soft-remove / restore markers for timeline calendar UI."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response

from server.api.deps import get_db, publish_resource_modified
from server.api.schemas.requests import TimelineDismissalBody
from server.api.schemas.responses import TimelineDismissalResponse
from server.calendar.timeline_dismissals import (
    TimelineDismissalValidationError,
    dismiss_timeline_event,
    list_timeline_dismissals,
    restore_timeline_event,
)
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error

router = APIRouter(prefix="/dismissals", tags=["calendar"])

# Map dismissal source → resource_modified type already watched by Board / Timeline.
_DISMISS_RESOURCE_TYPE: dict[str, str] = {
    "analysis": "task",
    "recurring": "recurring",
    "user": "user_event",
    "item_remind": "item",
}


def _http_from_validation(exc: TimelineDismissalValidationError):
    return http_error(422, str(exc), error_code=VALIDATION_ERROR)


def _notify_dismissal(request: Request, source: str, event_id: str, action: str) -> None:
    resource_type = _DISMISS_RESOURCE_TYPE.get(source)
    if resource_type is None:
        return
    publish_resource_modified(request, resource_type, event_id, action)


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
        payload = await dismiss_timeline_event(db, source=body.source, event_id=body.eventId)
    except TimelineDismissalValidationError as exc:
        raise _http_from_validation(exc) from exc
    _notify_dismissal(request, str(payload["source"]), str(payload["eventId"]), "dismissed")
    return payload


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
    _notify_dismissal(request, source.strip(), resolved, "restored")
    return Response(status_code=204)

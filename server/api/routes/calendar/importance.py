"""Mark / unmark 「重要事件」 for timeline calendar UI."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response

from server.api.deps import get_db, publish_resource_modified
from server.api.schemas.requests import TimelineImportanceBody
from server.api.schemas.responses import TimelineImportanceResponse
from server.calendar.timeline_importance import (
    TimelineImportanceValidationError,
    list_timeline_importance,
    mark_timeline_important,
    unmark_timeline_important,
)
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error

router = APIRouter(prefix="/importance", tags=["calendar"])

_IMPORTANCE_RESOURCE_TYPE: dict[str, str] = {
    "analysis": "task",
    "recurring": "task",
    "user": "user_event",
    "item": "item",
}


def _http_from_validation(exc: TimelineImportanceValidationError):
    return http_error(422, str(exc), error_code=VALIDATION_ERROR)


def _notify_importance(request: Request, source: str, event_id: str, action: str) -> None:
    resource_type = _IMPORTANCE_RESOURCE_TYPE.get(source)
    if resource_type is None:
        return
    publish_resource_modified(request, resource_type, event_id, action)


@router.get("", response_model=list[TimelineImportanceResponse])
async def list_importance(
    request: Request,
    source: str | None = None,
) -> list[dict]:
    db = get_db(request)
    try:
        return await list_timeline_importance(db, source=source)
    except TimelineImportanceValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.put("", response_model=TimelineImportanceResponse)
async def put_importance(request: Request, body: TimelineImportanceBody) -> dict:
    db = get_db(request)
    try:
        payload = await mark_timeline_important(db, source=body.source, event_id=body.eventId)
    except TimelineImportanceValidationError as exc:
        raise _http_from_validation(exc) from exc
    _notify_importance(request, str(payload["source"]), str(payload["eventId"]), "important")
    return payload


@router.delete("", status_code=204)
async def delete_importance(
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
        cleared = await unmark_timeline_important(db, source=source, event_id=resolved)
    except TimelineImportanceValidationError as exc:
        raise _http_from_validation(exc) from exc
    if not cleared:
        raise http_error(404, "Importance marker not found", error_code=NOT_FOUND)
    _notify_importance(request, source.strip(), resolved, "unimportant")
    return Response(status_code=204)

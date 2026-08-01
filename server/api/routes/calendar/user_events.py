"""User events CRUD under the unified calendar API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from server.api.deps import get_db, publish_resource_modified
from server.api.schemas.responses import UserEventResponse
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.calendar.user_events import (
    UserEventTaskIdError,
    UserEventValidationError,
    UserEventWorksetIdError,
    create_user_event,
    delete_user_event,
    get_user_event,
    list_user_events,
    update_user_event,
)

router = APIRouter(prefix="/user-events", tags=["calendar"])


class UserEventCreateBody(BaseModel):
    title: str
    startTime: str
    endTime: str | None = None
    body: str = ""
    location: str = ""
    #: Optional analysis-task provenance; omit / null / "" → NULL. ``__user__`` rejected.
    taskId: str | None = None
    #: Ownership workset; omit / null / "" / "__user__" → builtin system workset.
    worksetId: str | None = None
    model_config = {"extra": "forbid"}


class UserEventPatchBody(BaseModel):
    title: str | None = None
    startTime: str | None = None
    endTime: str | None = Field(default=None)
    body: str | None = None
    location: str | None = None
    taskId: str | None = None
    worksetId: str | None = None
    model_config = {"extra": "forbid"}


def _http_from_validation(exc: UserEventValidationError) -> HTTPException:
    status = 400 if isinstance(exc, (UserEventTaskIdError, UserEventWorksetIdError)) else 422
    return http_error(status, str(exc), error_code=VALIDATION_ERROR)


def _not_found() -> HTTPException:
    return http_error(404, "User event not found", error_code=NOT_FOUND)


def _notify(request: Request, event_id: str, action: str) -> None:
    publish_resource_modified(request, "user_event", event_id, action)


@router.get("", response_model=list[UserEventResponse])
async def list_events(
    request: Request,
    start: str | None = None,
    end: str | None = None,
    task_id: str | None = None,
    workset_id: str | None = None,
) -> list[UserEventResponse]:
    db = get_db(request)
    try:
        rows = await list_user_events(db, start=start, end=end, task_id=task_id, workset_id=workset_id)
    except UserEventValidationError as exc:
        raise _http_from_validation(exc) from exc
    return [UserEventResponse.model_validate(row) for row in rows]


@router.post("", status_code=201, response_model=UserEventResponse)
async def create_event(request: Request, body: UserEventCreateBody) -> UserEventResponse:
    db = get_db(request)
    fields_set = body.model_fields_set
    try:
        kwargs: dict[str, Any] = {
            "title": body.title,
            "start_time": body.startTime,
            "end_time": body.endTime,
            "body": body.body,
            "location": body.location,
            "origin": "manual",
            "task_id": body.taskId,
        }
        if "worksetId" in fields_set:
            kwargs["workset_id"] = body.worksetId
        item = await create_user_event(db, **kwargs)
    except UserEventValidationError as exc:
        raise _http_from_validation(exc) from exc
    _notify(request, item["id"], "created")
    return UserEventResponse.model_validate(item)


@router.get("/{event_id}", response_model=UserEventResponse)
async def get_event(request: Request, event_id: str) -> UserEventResponse:
    item = await get_user_event(get_db(request), event_id)
    if item is None:
        raise _not_found()
    return UserEventResponse.model_validate(item)


@router.patch("/{event_id}", response_model=UserEventResponse)
async def patch_event(
    request: Request,
    event_id: str,
    body: UserEventPatchBody,
) -> UserEventResponse:
    db = get_db(request)
    raw = body.model_dump(exclude_unset=True)
    if not raw:
        item = await get_user_event(db, event_id)
        if item is None:
            raise _not_found()
        return UserEventResponse.model_validate(item)

    wire_to_service = {
        "title": "title",
        "startTime": "start_time",
        "endTime": "end_time",
        "body": "body",
        "location": "location",
        "taskId": "task_id",
        "worksetId": "workset_id",
    }
    kwargs: dict[str, Any] = {wire_to_service[key]: value for key, value in raw.items()}

    try:
        item = await update_user_event(db, event_id, **kwargs)
    except UserEventValidationError as exc:
        raise _http_from_validation(exc) from exc
    if item is None:
        raise _not_found()
    _notify(request, event_id, "updated")
    return UserEventResponse.model_validate(item)


@router.delete("/{event_id}", status_code=204)
async def remove_event(request: Request, event_id: str) -> Response:
    db = get_db(request)
    deleted = await delete_user_event(db, event_id)
    if not deleted:
        raise _not_found()
    _notify(request, event_id, "deleted")
    return Response(status_code=204)

"""User events routes: CRUD for manual / assistant timed entries."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from server.api.deps import API_DEPS, get_db, publish_resource_modified
from server.api.schemas.responses import UserEventResponse
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.user_events import (
    UserEventTaskIdError,
    UserEventValidationError,
    create_user_event,
    delete_user_event,
    get_user_event,
    list_user_events,
    update_user_event,
)

router = APIRouter(prefix="/api/v1/user-events", tags=["user-events"], dependencies=API_DEPS)


class UserEventCreateBody(BaseModel):
    title: str
    startTime: str
    endTime: str | None = None
    body: str = ""
    location: str = ""
    #: Optional owning task; omit / null / "" / "__user__" → 用戶或助手 (NULL).
    taskId: str | None = None
    model_config = {"extra": "forbid"}


class UserEventPatchBody(BaseModel):
    title: str | None = None
    startTime: str | None = None
    endTime: str | None = Field(default=None)
    body: str | None = None
    location: str | None = None
    taskId: str | None = None
    # Optional clearable fields use exclude_unset on model_dump below.
    model_config = {"extra": "forbid"}


def _http_from_validation(exc: UserEventValidationError) -> HTTPException:
    """A bad ``taskId`` is a 400; every other field problem is a 422."""
    status = 400 if isinstance(exc, UserEventTaskIdError) else 422
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
) -> list[UserEventResponse]:
    db = get_db(request)
    rows = await list_user_events(db, start=start, end=end, task_id=task_id)
    return [UserEventResponse.model_validate(row) for row in rows]


@router.post("", status_code=201, response_model=UserEventResponse)
async def create_event(request: Request, body: UserEventCreateBody) -> UserEventResponse:
    db = get_db(request)
    try:
        item = await create_user_event(
            db,
            title=body.title,
            start_time=body.startTime,
            end_time=body.endTime,
            body=body.body,
            location=body.location,
            origin="manual",
            task_id=body.taskId,
        )
    except UserEventValidationError as exc:
        raise _http_from_validation(exc) from exc
    _notify(request, item["id"], "created")
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

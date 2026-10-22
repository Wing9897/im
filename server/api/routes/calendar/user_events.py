"""User events CRUD under the unified calendar API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from server.api.deps import get_db, publish_resource_modified
from server.api.query_aliases import qalias
from server.api.schemas.requests.calendar import UserEventCreateBody, UserEventPatchBody
from server.api.schemas.responses import UserEventResponse, UserEventsPageResponse
from server.calendar.user_events_normalize import (
    UserEventItemIdError,
    UserEventTaskIdError,
    UserEventValidationError,
    UserEventWorksetIdError,
)
from server.calendar.user_events_read import get_user_event, list_user_events_page
from server.calendar.user_events_write import (
    create_user_event,
    delete_user_event,
    update_user_event,
)
from server.calendar.write_input import UserEventWriteInput
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error

router = APIRouter(prefix="/user-events", tags=["calendar"])


def _http_from_validation(exc: UserEventValidationError) -> HTTPException:
    status = 400 if isinstance(exc, (UserEventTaskIdError, UserEventWorksetIdError, UserEventItemIdError)) else 422
    return http_error(status, str(exc), error_code=VALIDATION_ERROR)


def _not_found() -> HTTPException:
    return http_error(404, "User event not found", error_code=NOT_FOUND)


def _notify(request: Request, event_id: str, action: str) -> None:
    publish_resource_modified(request, "user_event", event_id, action)


@router.get("", response_model=UserEventsPageResponse)
async def list_events(
    request: Request,
    start_time: str | None = qalias("startTime", default=None),
    end_time: str | None = qalias("endTime", default=None),
    task_id: str | None = qalias("taskId", default=None),
    workset_id: str | None = qalias("worksetId", default=None),
    item_id: str | None = qalias("itemId", default=None),
    search: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> UserEventsPageResponse:
    db = get_db(request)
    try:
        page = await list_user_events_page(
            db,
            start=start_time,
            end=end_time,
            task_id=task_id,
            workset_id=workset_id,
            item_id=item_id,
            search=search,
            limit=limit,
            offset=offset,
        )
    except UserEventValidationError as exc:
        raise _http_from_validation(exc) from exc
    return UserEventsPageResponse(
        items=[UserEventResponse.model_validate(row) for row in page["items"]],
        totalCount=int(page["totalCount"]),
        hasMore=bool(page["hasMore"]),
    )


@router.post("", status_code=201, response_model=UserEventResponse)
async def create_event(request: Request, body: UserEventCreateBody) -> UserEventResponse:
    db = get_db(request)
    try:
        payload = UserEventWriteInput.from_pydantic_body(body)
        item = await create_user_event(db, **payload.service_kwargs())
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
    payload = UserEventWriteInput.from_pydantic_body(body)
    if not payload.fields_set:
        item = await get_user_event(db, event_id)
        if item is None:
            raise _not_found()
        return UserEventResponse.model_validate(item)

    try:
        item = await update_user_event(db, event_id, **payload.service_kwargs())
    except UserEventValidationError as exc:
        raise _http_from_validation(exc) from exc
    if item is None:
        raise _not_found()
    _notify(request, event_id, "updated")
    return UserEventResponse.model_validate(item)


@router.delete("/{event_id}", status_code=204)
async def remove_event(request: Request, event_id: str) -> Response:
    """Hard-delete the user_events row. Timeline hide stays on /calendar/dismissals."""
    db = get_db(request)
    deleted = await delete_user_event(db, event_id)
    if not deleted:
        raise _not_found()
    _notify(request, event_id, "deleted")
    return Response(status_code=204)

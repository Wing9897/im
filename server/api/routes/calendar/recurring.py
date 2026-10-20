"""Standalone recurring series CRUD under ``/api/v1/calendar/recurring``."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from server.api.deps import get_db, publish_resource_modified
from server.api.query_aliases import qalias
from server.api.schemas.requests.calendar import RecurringSeriesCreateBody, RecurringSeriesPatchBody
from server.api.schemas.responses.events import RecurringSeriesPageResponse, RecurringSeriesResponse
from server.calendar.user_events_normalize import UserEventItemIdError, resolve_user_event_item_id
from server.calendar.write_input import RecurringSeriesWriteInput
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries.recurring_series_queries import fetch_series_row, list_series_rows
from server.services.recurring_series_writes import (
    create_recurring_series,
    hard_delete_recurring_series,
    patch_recurring_series,
)
from server.services.task_writes import TaskWriteError
from server.wire.serializers import serialize_recurring_series

router = APIRouter(prefix="/recurring", tags=["calendar"])


def _notify(request: Request, series_id: str, action: str) -> None:
    publish_resource_modified(request, "recurring", series_id, action)


@router.get("", response_model=RecurringSeriesPageResponse)
async def list_recurring_series(
    request: Request,
    workset_id: str | None = qalias("worksetId", default=None),
    item_id: str | None = qalias("itemId", default=None),
    parent_task_id: str | None = qalias("parentTaskId", default=None),
    top_level_only: bool | None = qalias("topLevelOnly", default=None),
    search: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> RecurringSeriesPageResponse:
    db = get_db(request)
    rows, total = await list_series_rows(
        db,
        workset_id=workset_id,
        item_id=item_id,
        parent_task_id=parent_task_id,
        top_level_only=bool(top_level_only) if top_level_only is not None else False,
        search=search,
        limit=limit,
        offset=offset,
    )
    items = [RecurringSeriesResponse.model_validate(serialize_recurring_series(row)) for row in rows]
    has_more = False
    if limit is not None:
        has_more = (max(0, int(offset)) + len(items)) < total
    return RecurringSeriesPageResponse(items=items, totalCount=total, hasMore=has_more)


@router.post("", status_code=201, response_model=RecurringSeriesResponse)
async def create_recurring_series_endpoint(
    request: Request,
    body: RecurringSeriesCreateBody,
) -> RecurringSeriesResponse:
    db = get_db(request)
    payload = RecurringSeriesWriteInput.from_pydantic_body(body)
    try:
        payload = payload.with_item_id(await resolve_user_event_item_id(db, payload.itemId))
        row = await create_recurring_series(db, **payload.service_kwargs())
    except (TaskWriteError, UserEventItemIdError) as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    payload = serialize_recurring_series(row)
    _notify(request, str(payload["id"]), "created")
    return RecurringSeriesResponse.model_validate(payload)


@router.get("/{series_id}", response_model=RecurringSeriesResponse)
async def get_recurring_series(request: Request, series_id: str) -> RecurringSeriesResponse:
    row = await fetch_series_row(get_db(request), series_id)
    if row is None:
        raise http_error(404, "Recurring series not found", error_code=NOT_FOUND)
    return RecurringSeriesResponse.model_validate(serialize_recurring_series(row))


@router.patch("/{series_id}", response_model=RecurringSeriesResponse)
async def patch_recurring_series_endpoint(
    request: Request,
    series_id: str,
    body: RecurringSeriesPatchBody,
) -> RecurringSeriesResponse:
    db = get_db(request)
    payload = RecurringSeriesWriteInput.from_pydantic_body(body)
    try:
        if "itemId" in payload.fields_set:
            payload = payload.with_item_id(await resolve_user_event_item_id(db, payload.itemId))
        row = await patch_recurring_series(db, series_id=series_id, **payload.service_kwargs())
    except (TaskWriteError, UserEventItemIdError) as exc:
        status = 404 if "not found" in str(exc).lower() else 422
        raise http_error(status, str(exc), error_code=NOT_FOUND if status == 404 else VALIDATION_ERROR) from exc
    payload = serialize_recurring_series(row)
    _notify(request, series_id, "updated")
    return RecurringSeriesResponse.model_validate(payload)


@router.delete("/{series_id}", status_code=204)
async def delete_recurring_series_endpoint(request: Request, series_id: str) -> Response:
    try:
        await hard_delete_recurring_series(get_db(request), series_id=series_id)
    except TaskWriteError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    _notify(request, series_id, "deleted")
    return Response(status_code=204)

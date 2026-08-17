"""Standalone recurring series CRUD under ``/api/v1/calendar/recurring``."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request, Response

from server.api.deps import get_db, publish_resource_modified
from server.api.query_aliases import qalias
from server.api.schemas.requests.calendar import RecurringSeriesCreateBody, RecurringSeriesPatchBody
from server.api.schemas.responses.events import RecurringSeriesPageResponse, RecurringSeriesResponse
from server.calendar.user_events_normalize import UserEventItemIdError, resolve_user_event_item_id
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries.recurring_series_queries import fetch_series_row, list_series_rows
from server.services.recurring_series_writes import (
    create_recurring_series,
    hard_delete_recurring_series,
    patch_recurring_series,
)
from server.services.task_writes import TaskWriteError
from server.wire.serializer_domains.recurring import serialize_recurring_series
from server.worksets_const import SYSTEM_WORKSET_ID

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
    try:
        clean_item_id = await resolve_user_event_item_id(db, body.itemId)
        workset: Any = ...
        if "worksetId" in body.model_fields_set:
            workset = body.worksetId if body.worksetId else SYSTEM_WORKSET_ID
        row = await create_recurring_series(
            db,
            name=body.name,
            rrule=body.rrule,
            event_start_time=body.eventStartTime,
            event_end_time=body.eventEndTime,
            event_is_all_day=bool(body.eventIsAllDay),
            event_location=body.eventLocation,
            event_description=body.eventDescription,
            description=body.description,
            workset_id=workset,
            parent_task_id=body.parentTaskId,
            item_id=clean_item_id,
            notify_pref=body.notifyPref,
        )
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
    fields = body.model_fields_set
    kwargs: dict[str, Any] = {"series_id": series_id}
    if "name" in fields:
        kwargs["name"] = body.name
    if "rrule" in fields:
        kwargs["rrule"] = body.rrule
    if "eventStartTime" in fields:
        kwargs["event_start_time"] = body.eventStartTime
    if "eventEndTime" in fields:
        kwargs["event_end_time"] = body.eventEndTime
    if "eventIsAllDay" in fields:
        kwargs["event_is_all_day"] = body.eventIsAllDay
    if "eventLocation" in fields:
        kwargs["event_location"] = body.eventLocation
    if "eventDescription" in fields:
        kwargs["event_description"] = body.eventDescription
    if "description" in fields:
        kwargs["description"] = body.description
    if "isActive" in fields:
        kwargs["is_active"] = body.isActive
    if "worksetId" in fields:
        kwargs["workset_id"] = body.worksetId if body.worksetId else SYSTEM_WORKSET_ID
    if "notifyPref" in fields:
        kwargs["notify_pref"] = body.notifyPref
    try:
        if "itemId" in fields:
            await resolve_user_event_item_id(db, body.itemId)
            # itemId changes go through a direct SQL update after patch for simplicity
        row = await patch_recurring_series(db, **kwargs)
        if "itemId" in fields:
            clean_item = await resolve_user_event_item_id(db, body.itemId)
            await db.execute(
                "UPDATE recurring_schedules SET item_id = ?, updated_at = updated_at WHERE id = ?",
                (clean_item, series_id),
            )
            row = await fetch_series_row(db, series_id)
            if row is None:
                raise TaskWriteError("recurring series not found after itemId update")
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

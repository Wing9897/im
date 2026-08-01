"""Task schedule routes: GET/PUT/DELETE ``/api/v1/tasks/{id}/schedule``."""

from __future__ import annotations

from fastapi import Request, Response
from pydantic import BaseModel, ConfigDict, Field

from server.api.deps import get_db
from server.api.routes.task_helpers import get_task_row
from server.api.routes.tasks._common import notify, register_task
from server.api.routes.tasks._router import router
from server.api.schemas.responses import TaskScheduleResponse
from server.errors import VALIDATION_ERROR, http_error
from server.services.recurring_task_writes import delete_task_schedule, upsert_task_schedule
from server.services.task_writes import TaskWriteError
from server.wire.serializers import serialize_task_schedule


class TaskScheduleBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rrule: str
    eventStartTime: str | None = None
    eventEndTime: str | None = None
    eventIsAllDay: bool = False
    eventLocation: str | None = None
    eventDescription: str | None = None
    parentTaskId: str | None = Field(
        default=None,
        description="Optional project parent for nested recurring children",
    )


@router.get("/{task_id}/schedule", response_model=TaskScheduleResponse)
async def get_task_schedule(request: Request, task_id: str) -> dict:
    row = await get_task_row(get_db(request), task_id)
    payload = serialize_task_schedule(row)
    if payload is None:
        raise http_error(404, "Task schedule not found")
    return payload


@router.put("/{task_id}/schedule", response_model=TaskScheduleResponse)
async def put_task_schedule(request: Request, task_id: str, body: TaskScheduleBody) -> dict:
    db = get_db(request)
    await get_task_row(db, task_id)
    try:
        row = await upsert_task_schedule(
            db,
            task_id=task_id,
            rrule=body.rrule,
            event_start_time=body.eventStartTime,
            event_end_time=body.eventEndTime,
            event_is_all_day=bool(body.eventIsAllDay),
            event_location=body.eventLocation,
            event_description=body.eventDescription,
            parent_task_id=body.parentTaskId if "parentTaskId" in body.model_fields_set else ...,
        )
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    await register_task(request, task_id)
    notify(request, task_id, "updated")
    payload = serialize_task_schedule(row)
    if payload is None:
        raise http_error(500, "Task schedule missing after upsert")
    return payload


@router.delete("/{task_id}/schedule", status_code=204)
async def remove_task_schedule(request: Request, task_id: str) -> Response:
    db = get_db(request)
    await get_task_row(db, task_id)
    try:
        removed = await delete_task_schedule(db, task_id=task_id)
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    if not removed:
        raise http_error(404, "Task schedule not found")
    notify(request, task_id, "updated")
    return Response(status_code=204)

"""Fixed-path task catalog routes (templates / activity-spans / list / create)."""

from __future__ import annotations

from typing import Optional

from fastapi import Request

from server.api.deps import get_db
from server.api.query_aliases import qalias
from server.api.routes.task_helpers import TaskConfigBody, validate_task_body
from server.api.routes.tasks._common import notify, register_task
from server.api.routes.tasks._router import router
from server.api.schemas.requests import CreateRecurringTaskBody
from server.api.schemas.responses import TaskActivitySpanResponse, TaskResponse
from server.errors import VALIDATION_ERROR, http_error
from server.presets.task_presets import BUILTIN_PRESETS
from server.queries.tasks_queries import fetch_activity_span_rows
from server.services.task_crud import (
    create_recurring_task_record,
    create_task_record,
    list_tasks_payload,
)
from server.services.task_writes import TaskWriteError
from server.wire.serializers import serialize_activity_span


@router.get("/templates")
async def list_templates() -> list[dict]:
    return BUILTIN_PRESETS


@router.get("/activity-spans", response_model=list[TaskActivitySpanResponse])
async def activity_spans(request: Request) -> list[dict]:
    rows = await fetch_activity_span_rows(get_db(request))
    return [serialize_activity_span(row) for row in rows]


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    request: Request,
    top_level_only: Optional[bool] = qalias("topLevelOnly", default=None),
    analysis_mode: Optional[str] = qalias("analysisMode", default=None),
    workset_id: Optional[str] = qalias("worksetId", default=None),
    item_id: Optional[str] = qalias("itemId", default=None),
) -> list[dict]:
    try:
        return await list_tasks_payload(
            get_db(request),
            top_level_only=bool(top_level_only) if top_level_only is not None else False,
            analysis_mode=analysis_mode,
            workset_id=workset_id,
            item_id=item_id,
        )
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc


@router.post("/recurring", status_code=201, response_model=TaskResponse)
async def create_recurring_task_endpoint(
    request: Request,
    body: CreateRecurringTaskBody,
) -> dict:
    """Single-shot recurring create (task + schedule). See ``CreateRecurringTaskBody``."""
    try:
        result = await create_recurring_task_record(
            get_db(request),
            name=body.name,
            rrule=body.rrule,
            event_start_time=body.eventStartTime,
            event_end_time=body.eventEndTime,
            event_is_all_day=bool(body.eventIsAllDay),
            event_location=body.eventLocation,
            event_description=body.eventDescription,
            description=body.description,
            workset_id=body.worksetId if "worksetId" in body.model_fields_set else ...,
            parent_task_id=body.parentTaskId,
            item_id=body.itemId,
        )
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    if result.register:
        await register_task(request, result.task_id)
    notify(request, result.task_id, "created")
    return result.payload


@router.post("", status_code=201, response_model=TaskResponse)
async def create_task(request: Request, body: TaskConfigBody) -> dict:
    validate_task_body(body)
    try:
        result = await create_task_record(get_db(request), body)
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    if result.register:
        await register_task(request, result.task_id)
    notify(request, result.task_id, "created")
    return result.payload
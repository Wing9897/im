"""Fixed-path task catalog routes (templates / activity-spans / list / create)."""

from __future__ import annotations

from typing import Optional

from fastapi import Request

from server.api.deps import get_db
from server.api.query_aliases import qalias
from server.api.routes.task_helpers import TaskConfigBody, validate_task_body
from server.api.routes.tasks._common import notify, register_task
from server.api.routes.tasks._router import router
from server.api.schemas.responses import TaskActivitySpanResponse, TaskResponse
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.presets.task_presets import BUILTIN_PRESETS
from server.queries.tasks_queries import fetch_activity_span_rows
from server.services.task_crud import (
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


@router.api_route(
    "/recurring",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def retired_recurring_task_route() -> None:
    """Keep the removed static path from being captured as a task id (404, not 405)."""
    raise http_error(404, "Not found", error_code=NOT_FOUND)


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    request: Request,
    analysis_mode: Optional[str] = qalias("analysisMode", default=None),
    workset_id: Optional[str] = qalias("worksetId", default=None),
) -> list[dict]:
    try:
        return await list_tasks_payload(
            get_db(request),
            analysis_mode=analysis_mode,
            workset_id=workset_id,
        )
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc


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

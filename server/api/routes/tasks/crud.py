"""Task mutation routes: PUT/DELETE/PATCH ``/api/v1/tasks/{id}``."""

from __future__ import annotations

from fastapi import Request

from server.api.deps import get_db
from server.api.routes.task_helpers import TaskConfigBody, validate_task_body
from server.api.routes.tasks._common import notify, register_task, unregister_task
from server.api.routes.tasks._router import router
from server.api.schemas.responses import TaskDeleteResponse, TaskResponse
from server.errors import VALIDATION_ERROR, http_error
from server.services.task_crud import (
    delete_task_record,
    toggle_task_active_record,
    update_task_record,
)
from server.services.task_writes import TaskWriteError


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(request: Request, task_id: str, body: TaskConfigBody) -> dict:
    validate_task_body(body)
    try:
        result = await update_task_record(get_db(request), task_id, body)
    except LookupError as exc:
        raise http_error(404, str(exc)) from exc
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc

    if result.active_after is not None:
        if result.active_after:
            await register_task(request, task_id)
        else:
            await unregister_task(request, task_id)
    elif result.register:
        await register_task(request, task_id)

    notify(request, task_id, "updated")
    return result.payload


@router.delete("/{task_id}", response_model=TaskDeleteResponse)
async def delete_task(request: Request, task_id: str) -> dict:
    await unregister_task(request, task_id)
    try:
        payload = await delete_task_record(get_db(request), task_id)
    except LookupError as exc:
        await register_task(request, task_id)
        raise http_error(404, str(exc)) from exc
    except Exception:
        await register_task(request, task_id)
        raise

    notify(request, task_id, "deleted")
    return payload


@router.patch("/{task_id}/active", response_model=TaskResponse)
async def toggle_task_active(request: Request, task_id: str) -> dict:
    try:
        payload, new_active = await toggle_task_active_record(get_db(request), task_id)
    except LookupError as exc:
        raise http_error(404, str(exc)) from exc
    if new_active:
        await register_task(request, task_id)
    else:
        await unregister_task(request, task_id)
    notify(request, task_id, "updated")
    return payload

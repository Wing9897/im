"""HTTP assembly for task routes: status mapping stays in the route modules.

HTTP-agnostic policy lives in ``services.task_policy``.
Recurring-only recurrence expanded at query time; never an AI analysis trigger.
"""

from __future__ import annotations

from fastapi import HTTPException

from server.api.schemas.requests import TaskConfigBody
from server.errors import http_error
from server.services.task_writes import TaskWriteError
from server.services.tasks.write_input import TaskWriteInput

__all__ = [
    "TaskConfigBody",
    "task_write_http_error",
    "to_task_write_input",
]


def to_task_write_input(body: TaskConfigBody) -> TaskWriteInput:
    """Copy a parsed wire body into the service write input."""
    return TaskWriteInput.from_payload(body.model_dump(), body.model_fields_set)


def task_write_http_error(exc: TaskWriteError) -> HTTPException:
    """Map a task write rejection back to the historical HTTP status."""
    return http_error(exc.http_status, str(exc))

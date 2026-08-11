"""Task CRUD orchestration shared by REST routes (and future writers).

HTTP concerns (status codes, SSE notify, scheduler register) stay in the route
layer; this package owns the transactional write path and list filtering.

Public façade — list helpers in ``task_crud_list``, mutations in ``task_crud_mutate``.
"""

from __future__ import annotations

# Re-exported for tests that monkeypatch the delete write through this module.
from server.queries.tasks_queries import delete_analysis_task
from server.services.task_crud_list import list_tasks_payload
from server.services.task_crud_mutate import (
    TaskMutationResult,
    create_task_record,
    delete_task_record,
    toggle_task_active_record,
    update_task_record,
)

__all__ = [
    "TaskMutationResult",
    "create_task_record",
    "delete_analysis_task",
    "delete_task_record",
    "list_tasks_payload",
    "toggle_task_active_record",
    "update_task_record",
]

"""Shared types / validation for task CRUD mutations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from server.api.routes.task_helpers import require_task_row
from server.db.database import Database
from server.domain.analysis_modes import AGENT_MODE
from server.services.task_writes import TaskWriteError


@dataclass(frozen=True)
class TaskMutationResult:
    """Outcome of a create/update/delete that may need scheduler side effects."""

    task_id: str
    payload: dict[str, Any]
    register: bool = False
    unregister: bool = False
    #: After update, optional active toggle may need a second register/unregister.
    active_after: int | None = None


async def require_task_row_or_lookup(db: Database, task_id: str) -> dict[str, Any]:
    """Service-layer alias: missing task → ``LookupError`` (routes map to 404)."""
    return await require_task_row(db, task_id, missing=LookupError)


def validate_agent_prompt(*, effective_mode: str, prompt: str) -> None:
    if effective_mode != AGENT_MODE:
        return
    if not prompt.strip():
        raise TaskWriteError(
            "agent tasks require a non-empty promptTemplate "
            "(goals / search / extraction rules for the Agent)"
        )


__all__ = [
    "TaskMutationResult",
    "require_task_row_or_lookup",
    "validate_agent_prompt",
]

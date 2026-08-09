"""Agent-tick status route: ``GET /api/v1/tasks/{id}/agent-ticks``."""

from __future__ import annotations

from typing import Any

from fastapi import Query, Request

from server.api.deps import get_db
from server.api.routes.tasks._router import router
from server.api.schemas.responses import AgentTickStatusResponse
from server.errors import VALIDATION_ERROR, http_error
from server.services.agent_tick_status import build_agent_tick_status
from server.services.task_writes import TaskWriteError


@router.get("/{task_id}/agent-ticks", response_model=AgentTickStatusResponse)
async def agent_tick_status(
    request: Request,
    task_id: str,
    limit: int = Query(20, ge=1, le=50),
) -> dict[str, Any]:
    """Cursor backlog + recent agent-tick success/skip/error log."""
    try:
        return await build_agent_tick_status(get_db(request), task_id, limit=limit)
    except LookupError as exc:
        raise http_error(404, str(exc)) from exc
    except TaskWriteError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc

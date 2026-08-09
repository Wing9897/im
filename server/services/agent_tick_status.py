"""Assemble agent-tick status payloads for ``GET /tasks/{id}/agent-ticks``."""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.domain.analysis_modes import AGENT_MODE
from server.queries.agent_tick_queries import (
    count_agent_messages_since_cursor,
    fetch_agent_tick_in_flight_row,
    fetch_agent_tick_log_rows,
    load_agent_message_cursor,
)
from server.queries.tasks_queries import fetch_task_row
from server.services.task_writes import TaskWriteError
from server.wire.serializers import (
    serialize_agent_tick_in_flight,
    serialize_agent_tick_log_entry,
)


async def build_agent_tick_status(
    db: Database,
    task_id: str,
    *,
    limit: int = 20,
) -> dict[str, Any]:
    row = await fetch_task_row(db, task_id)
    if row is None:
        raise LookupError("Task not found")
    if str(row.get("analysis_mode") or "") != AGENT_MODE:
        raise TaskWriteError("Task is not analysis_mode=agent")
    cursor = await load_agent_message_cursor(db, task_id)
    pending = await count_agent_messages_since_cursor(db, task_id)
    ticks = await fetch_agent_tick_log_rows(db, task_id=task_id, limit=limit)
    in_flight = await fetch_agent_tick_in_flight_row(db, task_id=task_id)
    return {
        "taskId": task_id,
        "cursorAt": cursor.timestamp if cursor else None,
        "pendingSinceCursor": pending,
        "ticks": [serialize_agent_tick_log_entry(item) for item in ticks],
        "inFlight": serialize_agent_tick_in_flight(in_flight) if in_flight else None,
    }

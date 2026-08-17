"""Task list / read helpers for REST catalog routes."""

from __future__ import annotations

from typing import Any

from server.api.routes.task_helpers import ALLOWED_MODES
from server.db.database import Database
from server.queries.tasks_queries import fetch_all_task_channel_rows, fetch_all_task_rows
from server.services.task_writes import TaskWriteError
from server.wire.serializers import serialize_channel_ref, serialize_task
from server.worksets_const import SYSTEM_WORKSET_ID


async def list_tasks_payload(
    db: Database,
    *,
    analysis_mode: str | None = None,
    workset_id: str | None = None,
) -> list[dict[str, Any]]:
    rows = await fetch_all_task_rows(db)
    if analysis_mode is not None:
        mode = analysis_mode.strip()
        if mode == "recurring":
            raise TaskWriteError("analysisMode=recurring is removed; use GET /api/v1/calendar/recurring")
        if mode not in ALLOWED_MODES:
            raise TaskWriteError(f"Invalid analysis_mode: {analysis_mode}")
        rows = [row for row in rows if str(row.get("analysis_mode") or "") == mode]
    if workset_id is not None:
        wid = workset_id.strip() or SYSTEM_WORKSET_ID
        rows = [row for row in rows if str(row.get("workset_id") or SYSTEM_WORKSET_ID) == wid]
    links = await fetch_all_task_channel_rows(db)
    by_task: dict[str, list[dict[str, Any]]] = {}
    for link in links:
        by_task.setdefault(str(link["task_id"]), []).append(serialize_channel_ref(link))
    return [serialize_task(row, by_task.get(str(row["id"]), [])) for row in rows]

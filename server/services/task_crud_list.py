"""Task list / read helpers for REST catalog routes."""

from __future__ import annotations

from typing import Any, Optional

from server.api.routes.task_helpers import ALLOWED_MODES
from server.db.database import Database
from server.queries.tasks_queries import fetch_all_task_channel_rows, fetch_all_task_rows
from server.services.task_writes import TaskWriteError
from server.wire.serializers import serialize_channel_ref, serialize_task


async def list_tasks_payload(
    db: Database,
    *,
    top_level_only: bool = False,
    analysis_mode: Optional[str] = None,
    workset_id: Optional[str] = None,
    item_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    rows = await fetch_all_task_rows(db)
    if top_level_only:
        rows = [row for row in rows if not row.get("parent_task_id")]
    if analysis_mode is not None:
        mode = analysis_mode.strip()
        if mode not in ALLOWED_MODES:
            raise TaskWriteError(f"Invalid analysis_mode: {analysis_mode}")
        rows = [row for row in rows if str(row.get("analysis_mode") or "") == mode]
    if workset_id is not None:
        wid = workset_id.strip()
        if not wid:
            rows = [row for row in rows if not row.get("workset_id")]
        else:
            rows = [row for row in rows if str(row.get("workset_id") or "") == wid]
    if item_id is not None:
        # ``recurring_schedules.item_id`` (joined); empty string = unbound only.
        iid = item_id.strip()
        if not iid:
            rows = [row for row in rows if not row.get("item_id")]
        else:
            rows = [row for row in rows if str(row.get("item_id") or "") == iid]
    links = await fetch_all_task_channel_rows(db)
    by_task: dict[str, list[dict[str, Any]]] = {}
    for link in links:
        by_task.setdefault(str(link["task_id"]), []).append(serialize_channel_ref(link))
    return [serialize_task(row, by_task.get(str(row["id"]), [])) for row in rows]

"""Task create / update / delete / toggle mutation paths (façade).

Implementations: ``task_crud_create`` / ``task_crud_update``;
shared types in ``task_crud_mutate_common``.
"""

from __future__ import annotations

from typing import Any

from server.db.database import Database, TransactionDb
from server.queries.tasks_queries import delete_incomplete_batches, set_task_active
from server.services.task_crud_create import create_task_record
from server.services.task_crud_mutate_common import (
    TaskMutationResult,
    require_task_row_or_lookup,
)
from server.services.task_crud_update import update_task_record
from server.util import utc_now_iso
from server.wire.serializers import serialize_task


async def delete_task_record(db: Database, task_id: str) -> dict[str, Any]:
    await require_task_row_or_lookup(db, task_id)
    # Resolve through the façade so tests can monkeypatch ``task_crud.delete_analysis_task``.
    from server.services import task_crud as task_crud_facade

    async with db.transaction() as conn:
        deleted = await delete_incomplete_batches(conn, task_id)
        await task_crud_facade.delete_analysis_task(TransactionDb(conn), task_id)
    return {
        "taskId": task_id,
        "deletedBatchCount": len(deleted),
    }


async def toggle_task_active_record(db: Database, task_id: str) -> tuple[dict[str, Any], int]:
    from server.analyzer.llm_config import require_complete_profile_row
    from server.errors import VALIDATION_ERROR, http_error

    existing = await require_task_row_or_lookup(db, task_id)
    new_active = 0 if existing.get("is_active") else 1
    if new_active:
        profile_id = str(existing.get("llm_profile_id") or "").strip()
        if not profile_id:
            raise http_error(
                400,
                "Cannot activate task without a complete LLM profile",
                error_code=VALIDATION_ERROR,
            )
        await require_complete_profile_row(db, profile_id)
    await set_task_active(db, task_id, new_active, utc_now_iso())
    row = await require_task_row_or_lookup(db, task_id)
    return serialize_task(row, channel_refs=None), new_active


__all__ = [
    "TaskMutationResult",
    "create_task_record",
    "delete_task_record",
    "toggle_task_active_record",
    "update_task_record",
]

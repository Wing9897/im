"""Task create / update / delete / toggle mutation paths (façade).

Implementations: ``task_crud_create`` / ``task_crud_update``;
shared types in ``task_crud_mutate_common``.
"""

from __future__ import annotations

from typing import Any

from server.db.database import Database, TransactionDb
from server.queries.tasks_queries import delete_analysis_task, delete_incomplete_batches, set_task_active
from server.services.task_crud_create import create_task_record
from server.services.task_crud_mutate_common import (
    TaskMutationResult,
    require_task_row_or_lookup,
)
from server.services.task_crud_update import patch_task_emoji_record, update_task_record
from server.util import utc_now_iso
from server.wire.serializer_domains.tasks import serialize_task


async def delete_task_record(db: Database, task_id: str) -> dict[str, Any]:
    await require_task_row_or_lookup(db, task_id)

    async with db.transaction() as conn:
        deleted = await delete_incomplete_batches(conn, task_id)
        await delete_analysis_task(TransactionDb(conn), task_id)
    return {
        "taskId": task_id,
        "deletedBatchCount": len(deleted),
    }


async def toggle_task_active_record(db: Database, task_id: str) -> tuple[dict[str, Any], int]:
    from server.services.task_writes import TaskWriteError
    from server.services.tasks.channel_refs import channel_refs_for
    from server.services.tasks.llm_profile import ensure_complete_llm_profile

    existing = await require_task_row_or_lookup(db, task_id)
    new_active = 0 if existing.get("is_active") else 1
    if new_active:
        profile_id = str(existing.get("llm_profile_id") or "").strip()
        if not profile_id:
            raise TaskWriteError(
                "Cannot activate task without a complete LLM profile",
                http_status=400,
            )
        await ensure_complete_llm_profile(db, profile_id)
    await set_task_active(db, task_id, new_active, utc_now_iso())
    row = await require_task_row_or_lookup(db, task_id)
    channel_refs = await channel_refs_for(db, task_id)
    return serialize_task(row, channel_refs=channel_refs), new_active


__all__ = [
    "TaskMutationResult",
    "create_task_record",
    "delete_task_record",
    "patch_task_emoji_record",
    "toggle_task_active_record",
    "update_task_record",
]

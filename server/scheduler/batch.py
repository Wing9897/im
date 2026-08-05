"""One analysis batch: claim → prompt → LLM (lock-free) → persist → notify.

Invariants:
- Messages are claimed by inserting markers when the batch is created, so a
  retried batch reprocesses exactly its own message set (marker join).
- The LLM call happens with no transaction open.
- Results + batch completion are written in a single transaction.
- Permanent failure deletes the batch's markers so messages re-qualify.

Claim helpers: ``batch_claim``; failure path: ``batch_failure``;
process path: ``batch_process``. This module keeps the ``execute_batch`` entry.
"""

from __future__ import annotations

from typing import Any

from server.analyzer.incremental import fetch_unanalyzed_messages
from server.config import get_config_bool
from server.db.database import Database
from server.domain.analysis_modes import MESSAGE_BATCH_ANALYSIS_MODES
from server.scheduler.batch_claim import (
    create_batch_with_markers,
    find_pending_batch,
    load_task,
    task_has_channels,
)
from server.scheduler.batch_process import Engine, process_batch
from server.scheduler.task_schedule_overrides import (
    resolve_batch_message_limit,
    resolve_trigger_threshold,
)
from server.scheduler.under_threshold_skip import note_under_threshold_skip
from server.sse import Broadcaster

# Stable private symbol for tests (``from server.scheduler.batch import _process_batch``).
_process_batch = process_batch

__all__ = ["Engine", "execute_batch", "_process_batch"]


async def execute_batch(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    analysis_engine: Engine,
    action_executor: Any = None,
    analysis_paused: bool | None = None,
    scheduler: Any = None,
) -> None:
    """Dispatch entry point: pre-checks, claim (or resume), process."""
    if analysis_paused is None:
        analysis_paused = await get_config_bool(db, "analysis_paused")
    if analysis_paused:
        return

    task = await load_task(db, task_id)
    if task is None or not task.get("is_active"):
        return
    if task.get("analysis_mode") not in MESSAGE_BATCH_ANALYSIS_MODES:
        return
    if not await task_has_channels(db, task_id):
        return

    version = int(task.get("version") or 1)

    # Resume an existing pending batch (crash recovery / retriable failure).
    batch = await find_pending_batch(db, task_id, version)
    if batch is None:
        effective_limit = await resolve_batch_message_limit(db, task)
        effective_threshold = await resolve_trigger_threshold(db, task)

        messages = await fetch_unanalyzed_messages(db, task, limit_override=effective_limit)
        if not messages or len(messages) < effective_threshold:
            await note_under_threshold_skip(
                db,
                task_id=task_id,
                task_name=str(task.get("name") or ""),
                message_count=len(messages or []),
                threshold=effective_threshold,
                source="server.scheduler.batch",
            )
            return
        batch_id = await create_batch_with_markers(db, task, messages)
    else:
        batch_id = str(batch["id"])

    await _process_batch(
        db=db,
        broadcaster=broadcaster,
        task=task,
        batch_id=batch_id,
        analysis_engine=analysis_engine,
        action_executor=action_executor,
        scheduler=scheduler,
    )

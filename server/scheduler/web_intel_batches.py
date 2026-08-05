"""Persistence and failure lifecycle for scheduled web-intel batches."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from server.app_logging import record_batch_failure
from server.config import get_config_int
from server.db.database import Database
from server.domain.analysis_modes import WEB_INTEL_MODE
from server.queries.tasks_queries import set_task_active
from server.sse import Broadcaster
from server.util import new_id, utc_now_iso

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)


async def record_web_intel_skip(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task: dict[str, Any],
    task_id: str,
    reason: str,
) -> None:
    batch_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, agent_message, "
        "created_at, updated_at, completed_at) "
        "VALUES (?, ?, ?, 'completed', 0, ?, ?, ?, ?)",
        (batch_id, task_id, int(task.get("version") or 1), reason, now, now, now),
    )
    logger.info("web_intel tick skipped task=%s batch=%s: %s", task_id, batch_id, reason)
    broadcaster.publish(
        "analysis_completed",
        {
            "taskId": task_id,
            "batchId": batch_id,
            "analysisMode": WEB_INTEL_MODE,
            "findingsCount": 0,
            "hasFindings": False,
            "skipped": True,
            "skipReason": reason,
        },
    )


async def count_consecutive_failures(db: Database, *, task_id: str, version: int) -> int:
    rows = await db.fetch_all(
        "SELECT error_message, agent_message FROM analysis_batches "
        "WHERE task_id = ? AND version = ? AND status = 'completed' "
        "ORDER BY COALESCE(completed_at, updated_at) DESC, rowid DESC LIMIT 50",
        (task_id, version),
    )
    count = 0
    for row in rows:
        if str(row.get("agent_message") or "").startswith("skipped:"):
            break
        if row.get("error_message"):
            count += 1
        else:
            break
    return count


async def complete_web_intel_failure(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    task_name: str,
    batch_id: str,
    version: int,
    error_message: str,
    scheduler: SchedulerManager | None,
    failure_details: dict[str, Any] | None = None,
) -> None:
    err_now = utc_now_iso()
    await db.execute(
        "UPDATE analysis_batches SET status = 'completed', error_message = ?, "
        "updated_at = ?, completed_at = ? WHERE id = ?",
        (error_message[:2000], err_now, err_now, batch_id),
    )
    max_retries = await get_config_int(db, "max_batch_retries")
    consecutive = await count_consecutive_failures(db, task_id=task_id, version=version)
    retries_exhausted = consecutive >= max_retries
    await record_batch_failure(
        db,
        task_id=task_id,
        task_name=task_name,
        batch_id=batch_id,
        error_message=error_message,
        retries_exhausted=retries_exhausted,
        current_retry=consecutive,
        max_retries=max_retries,
        failure_details=failure_details,
    )
    if retries_exhausted:
        await set_task_active(db, task_id, 0, err_now)
        if scheduler is not None:
            await scheduler.unregister_task(task_id)
        logger.warning(
            "web_intel task %s deactivated after %d consecutive failure(s) (max_batch_retries=%d)",
            task_id,
            consecutive,
            max_retries,
        )
    broadcaster.publish(
        "analysis_failed",
        {
            "taskId": task_id,
            "taskName": task_name,
            "batchId": batch_id,
            "error": error_message[:500],
            "analysisMode": WEB_INTEL_MODE,
            "retrying": not retries_exhausted,
            "currentRetry": consecutive,
            "maxRetries": max_retries,
            "retriesExhausted": retries_exhausted,
            "taskDeactivated": retries_exhausted,
        },
    )


async def open_processing_batch(
    db: Database,
    *,
    task: dict[str, Any],
    message_count: int,
) -> str:
    batch_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, created_at, updated_at) "
        "VALUES (?, ?, ?, 'processing', ?, ?, ?)",
        (batch_id, str(task["id"]), int(task.get("version") or 1), message_count, now, now),
    )
    return batch_id

"""Batch failure handling: retry-in-place policy, logging, and SSE notifications."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from server.analysis_control import set_analysis_paused
from server.app_logging import record_batch_failure
from server.config import get_auto_pause_on_retries_exhausted, get_config_int
from server.db.database import Database
from server.sse import Broadcaster
from server.util import utc_now_iso

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)


@dataclass
class BatchErrorOutcome:
    """Next retry counter (0 when the current cycle is exhausted)."""

    next_retry: int
    retries_exhausted: bool


def decide_batch_error_outcome(error_message: str, current_retry: int, max_retries: int) -> BatchErrorOutcome:
    """All analysis errors retry in-place; exhaustion triggers optional global pause."""
    _ = error_message
    next_retry = current_retry + 1
    retries_exhausted = next_retry >= max_retries
    return BatchErrorOutcome(
        next_retry=0 if retries_exhausted else next_retry,
        retries_exhausted=retries_exhausted,
    )


async def apply_retry_outcome(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    task_name: str,
    batch_id: str,
    error_message: str,
    outcome: BatchErrorOutcome,
    max_retries: int,
    scheduler: SchedulerManager | None = None,
    failure_details: dict[str, Any] | None = None,
) -> None:
    """Persist retry state and emit logs/SSE/auto-pause side effects."""
    now = utc_now_iso()

    await db.execute(
        "UPDATE analysis_batches SET status = 'pending', retry_count = ?, "
        "error_message = ?, updated_at = ? WHERE id = ?",
        (outcome.next_retry, error_message, now, batch_id),
    )

    if outcome.retries_exhausted:
        logger.warning(
            "Batch %s exhausted retries (%d); staying pending for resume: %s",
            batch_id,
            max_retries,
            error_message,
        )
        if await get_auto_pause_on_retries_exhausted(db):
            paused = await set_analysis_paused(db, scheduler, paused=True)
            logger.warning(
                "Auto-paused global analysis after batch retries exhausted (task=%s, batch=%s)",
                task_id,
                batch_id,
            )
            broadcaster.publish(
                "analysis_paused_changed",
                {
                    "analysisPaused": paused,
                    "reason": "batch_retries_exhausted",
                    "taskId": task_id,
                    "taskName": task_name,
                    "batchId": batch_id,
                },
            )
    else:
        logger.warning(
            "Batch %s error (retrying) (%d/%d): %s",
            batch_id,
            outcome.next_retry,
            max_retries,
            error_message,
        )

    await record_batch_failure(
        db,
        task_id=task_id,
        task_name=task_name,
        batch_id=batch_id,
        error_message=error_message,
        retries_exhausted=outcome.retries_exhausted,
        current_retry=outcome.next_retry,
        max_retries=max_retries,
        failure_details=failure_details,
    )

    broadcaster.publish(
        "analysis_failed",
        {
            "taskId": task_id,
            "taskName": task_name,
            "batchId": batch_id,
            "error": error_message,
            "retrying": True,
            "currentRetry": outcome.next_retry,
            "maxRetries": max_retries,
            "retriesExhausted": outcome.retries_exhausted,
        },
    )


async def handle_batch_failure(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    task_name: str,
    batch_id: str,
    error_message: str,
    scheduler: SchedulerManager | None = None,
    failure_details: dict[str, Any] | None = None,
) -> None:
    batch = await db.fetch_one("SELECT retry_count FROM analysis_batches WHERE id = ?", (batch_id,))
    current_retry = int(batch["retry_count"]) if batch else 0
    max_retries = await get_config_int(db, "max_batch_retries")

    outcome = decide_batch_error_outcome(error_message, current_retry, max_retries)
    await apply_retry_outcome(
        db=db,
        broadcaster=broadcaster,
        task_id=task_id,
        task_name=task_name,
        batch_id=batch_id,
        error_message=error_message,
        outcome=outcome,
        max_retries=max_retries,
        scheduler=scheduler,
        failure_details=failure_details,
    )

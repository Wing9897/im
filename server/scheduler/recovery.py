"""Startup recovery for batches interrupted by a previous process."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from server.config import get_config_bool, get_config_int
from server.db.database import Database
from server.domain.analysis_modes import AGENT_MODE
from server.queries.batch_housekeeping import purge_all_superseded_version_data
from server.scheduler.agent_batches import complete_agent_failure
from server.scheduler.batch_failure import apply_retry_outcome, decide_batch_error_outcome
from server.sse import SseBroadcaster
from server.util import utc_now_iso

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)


async def recover_orphan_batches(
    db: Database,
    broadcaster: SseBroadcaster,
    scheduler: SchedulerManager,
) -> None:
    """Recover marker batches while closing non-retryable tick batches."""
    now = utc_now_iso()
    tick_orphans = await db.fetch_all(
        "SELECT b.id, b.task_id, t.name AS task_name, t.version FROM analysis_batches b "
        "JOIN analysis_tasks t ON t.id = b.task_id "
        "WHERE b.status = 'processing' AND t.analysis_mode = ?",
        (AGENT_MODE,),
    )
    for row in tick_orphans:
        await complete_agent_failure(
            db=db,
            broadcaster=broadcaster,
            task_id=str(row["task_id"]),
            task_name=str(row["task_name"] or ""),
            batch_id=str(row["id"]),
            version=int(row["version"] or 1),
            error_message="interrupted: process restart",
            scheduler=scheduler,
            count_toward_fuse=False,
        )
    if tick_orphans:
        logger.info("Closed %d interrupted tick batch(es) on recovery", len(tick_orphans))

    await db.execute(
        "UPDATE analysis_batches SET status = 'pending', updated_at = ? WHERE status = 'processing'",
        (now,),
    )

    if await get_config_bool(db, "analysis_paused"):
        logger.info("Skipping stale-pending orphan sweep while analysis is paused")
    else:
        timeout = await get_config_int(db, "llm_generation_timeout")
        max_retries = await get_config_int(db, "max_batch_retries")
        stalled = await db.fetch_all(
            "SELECT b.id, b.retry_count, b.task_id, t.name AS task_name "
            "FROM analysis_batches b "
            "JOIN analysis_tasks t ON t.id = b.task_id "
            "WHERE b.status = 'pending' "
            "AND t.analysis_mode != ? "
            "AND datetime(b.updated_at) < datetime('now', ?)",
            (AGENT_MODE, f"-{timeout * 2} seconds"),
        )
        for row in stalled:
            retry_count = int(row["retry_count"] or 0)
            outcome = decide_batch_error_outcome("orphan batch recovery", retry_count, max_retries)
            await apply_retry_outcome(
                db=db,
                broadcaster=broadcaster,
                task_id=str(row["task_id"]),
                task_name=str(row["task_name"]),
                batch_id=str(row["id"]),
                error_message="orphan batch recovery",
                outcome=outcome,
                max_retries=max_retries,
                scheduler=scheduler,
            )

    pruned_batches = await purge_all_superseded_version_data(db)
    if pruned_batches:
        logger.info("Pruned %d superseded-version batch rows (and matching results)", pruned_batches)

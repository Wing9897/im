"""Unified analysis pause/resume/abort control.

Single entry point for persisting ``analysis_paused`` and driving the scheduler.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from server.app_logging import record
from server.config import get_config_bool, set_configs

if TYPE_CHECKING:
    from server.db.database import Database
    from server.scheduler.manager import SchedulerManager


async def set_analysis_paused(
    db: Database,
    scheduler: SchedulerManager | None,
    *,
    paused: bool,
) -> bool:
    """Persist pause flag and sync scheduler timers.

    Writes one Settings→Logs event when the paused flag actually changes
    (manual pause, auto-pause, or emergency abort path).
    """
    previous = await get_config_bool(db, "analysis_paused")
    await set_configs(db, {"analysis_paused": "true" if paused else "false"})
    if scheduler is not None:
        if paused and not scheduler.paused:
            await scheduler.pause()
        elif not paused and scheduler.paused:
            await scheduler.resume()
    if previous != paused:
        await record(
            db,
            level="warning" if paused else "success",
            category="analysis",
            kind="scheduler.paused" if paused else "scheduler.resumed",
            message=(
                "Analysis scheduler paused"
                if paused
                else "Analysis scheduler resumed"
            ),
            message_key=(
                "logs:templates.schedulerPaused"
                if paused
                else "logs:templates.schedulerResumed"
            ),
            source="server.analysis_control",
            payload={"analysisPaused": paused},
        )
    return paused


async def emergency_abort(
    db: Database,
    scheduler: SchedulerManager | None,
) -> dict[str, Any]:
    """Abort in-flight batches, delete processing rows, pause analysis."""
    aborted_batch_ids: list[str] = []
    if scheduler is not None:
        await scheduler.pause()
        _, aborted_batch_ids = await scheduler.abort_in_flight(db)
    # Persist + AppLog via the single pause entry (scheduler already paused).
    await set_analysis_paused(db, None, paused=True)
    return {
        "analysisPaused": True,
        "abortedBatchIds": aborted_batch_ids,
    }


async def delete_processing_batches(db: Database) -> list[str]:
    """Delete all processing batches; marker rows cascade and messages re-queue."""
    rows = await db.fetch_all("SELECT id FROM analysis_batches WHERE status = 'processing'")
    batch_ids = [str(row["id"]) for row in rows]
    if not batch_ids:
        return []
    placeholders = ",".join("?" for _ in batch_ids)
    await db.execute(
        f"DELETE FROM analysis_batches WHERE id IN ({placeholders})",
        tuple(batch_ids),
    )
    return batch_ids

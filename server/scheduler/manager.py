"""Per-task scheduling with explicit capacity control.

APScheduler drives per-task timers; concurrency is a plain integer capacity
counter (atomic within the event loop — no semaphore swapping bugs), with a
FIFO wait queue drained by a background dispatch worker. Also owns the
retention timer and startup orphan-batch recovery.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from server.config import get_config_bool, get_config_int
from server.db.database import Database
from server.domain.analysis_modes import (
    PARENT_PROJECT_MODE,
    SCHEDULABLE_ANALYSIS_MODES,
    WEB_INTEL_MODE,
    get_analysis_mode_spec,
)
from server.domain.schedule import (
    ScheduleValidationError,
    may_register_trigger,
    trigger_from_rrule,
)
from server.queries.batch_housekeeping import purge_all_superseded_version_data
from server.queries.project_tick_queries import complete_project_batch
from server.scheduler.batch import execute_batch
from server.scheduler.batch_failure import apply_retry_outcome, decide_batch_error_outcome
from server.scheduler.project_tick import execute_project_tick
from server.scheduler.retention import retention_timer
from server.scheduler.web_intel_tick import execute_web_intel_tick
from server.sse import SseBroadcaster
from server.util import utc_now_iso

logger = logging.getLogger(__name__)

_SHUTDOWN_GRACE_SECONDS = 30.0


@dataclass
class _QueuedTask:
    task_id: str
    enqueued_at: float


def schedule_trigger_from_rrule(schedule_rrule: str) -> IntervalTrigger | CronTrigger:
    """Build an AI-analysis trigger solely from ``analysis_tasks.schedule_rrule``.

    Calendar RRULE and event metadata are recurring-only and intentionally are not inputs.
    SECONDLY trigger RRULEs must never enter calendar expand.
    """
    try:
        return trigger_from_rrule(schedule_rrule)
    except ScheduleValidationError as exc:
        raise ValueError(str(exc)) from exc


class SchedulerManager:
    """Owns per-task timers, batch dispatch, retention timer, recovery."""

    def __init__(
        self,
        db: Database,
        analysis_engine: Any,
        broadcaster: SseBroadcaster,
        action_executor: Any = None,
    ) -> None:
        self._db = db
        self._analysis_engine = analysis_engine
        self._broadcaster = broadcaster
        self._action_executor = action_executor
        self._scheduler = AsyncIOScheduler()
        self._wait_queue: deque[_QueuedTask] = deque()
        self._paused = False
        self._max_concurrent = 1
        self._available = 1
        self._in_flight = 0
        self._in_flight_tasks: dict[asyncio.Task[None], str] = {}
        self._dispatch_event = asyncio.Event()
        self._drain_event: Optional[asyncio.Event] = None
        self._dispatch_task: Optional[asyncio.Task] = None
        self._retention_task: Optional[asyncio.Task] = None
        self._started = False

    # ── startup / recovery ──────────────────────────────────────────────

    async def recover_orphan_batches(self) -> None:
        """Reset batches stranded by a previous process.

        Project-tick batches are not marker-claim retries: complete interrupted
        ``processing`` rows and never stall-sweep them into auto-pause.
        """
        now = utc_now_iso()

        # Project / web_intel fires left mid-run: close as completed(error).
        # These modes have no marker-claim retry path.
        tick_orphans = await self._db.fetch_all(
            "SELECT b.id, b.message_count, t.analysis_mode FROM analysis_batches b "
            "JOIN analysis_tasks t ON t.id = b.task_id "
            "WHERE b.status = 'processing' AND t.analysis_mode IN (?, ?)",
            (PARENT_PROJECT_MODE, WEB_INTEL_MODE),
        )
        for row in tick_orphans:
            await complete_project_batch(
                self._db,
                str(row["id"]),
                error_message="interrupted: process restart",
                message_count=int(row["message_count"] or 0),
            )
        if tick_orphans:
            logger.info(
                "Closed %d interrupted tick batch(es) on recovery",
                len(tick_orphans),
            )

        # Marker-batch crash recovery — everything left in 'processing' → 'pending'.
        await self._db.execute(
            "UPDATE analysis_batches SET status = 'pending', updated_at = ? WHERE status = 'processing'",
            (now,),
        )

        # Threshold-based orphan handling for long-stalled marker batches.
        # Skip while analysis is paused — pending stalls are expected (capacity /
        # pause), not crash orphans; sweeping them can false-positive auto-pause.
        # Project pending rows (if any) must not enter retry/auto-pause either.
        if await get_config_bool(self._db, "analysis_paused"):
            logger.info("Skipping stale-pending orphan sweep while analysis is paused")
        else:
            timeout = await get_config_int(self._db, "llm_generation_timeout")
            max_retries = await get_config_int(self._db, "max_batch_retries")
            stall_seconds = timeout * 2
            stalled = await self._db.fetch_all(
                "SELECT b.id, b.retry_count, b.task_id, t.name AS task_name "
                "FROM analysis_batches b "
                "JOIN analysis_tasks t ON t.id = b.task_id "
                "WHERE b.status = 'pending' "
                "AND t.analysis_mode NOT IN (?, ?) "
                "AND datetime(b.updated_at) < datetime('now', ?)",
                (PARENT_PROJECT_MODE, WEB_INTEL_MODE, f"-{stall_seconds} seconds"),
            )
            for row in stalled:
                batch_id = str(row["id"])
                retry_count = int(row["retry_count"] or 0)
                task_id = str(row["task_id"])
                task_name = str(row["task_name"])
                outcome = decide_batch_error_outcome("orphan batch recovery", retry_count, max_retries)
                await apply_retry_outcome(
                    db=self._db,
                    broadcaster=self._broadcaster,
                    task_id=task_id,
                    task_name=task_name,
                    batch_id=batch_id,
                    error_message="orphan batch recovery",
                    outcome=outcome,
                    max_retries=max_retries,
                    scheduler=self,
                )

        pruned_batches = await purge_all_superseded_version_data(self._db)
        if pruned_batches:
            logger.info("Pruned %d superseded-version batch rows (and matching results)", pruned_batches)

    async def start(self) -> None:
        self._max_concurrent = await self._load_max_concurrent()
        self._available = self._max_concurrent
        self._paused = await get_config_bool(self._db, "analysis_paused")
        if not self._paused:
            await self._register_all_active_tasks()
        self._dispatch_task = asyncio.create_task(self._dispatch_queue_worker())
        self._retention_task = asyncio.create_task(retention_timer(self._db))
        self._scheduler.start()
        self._started = True
        logger.info(
            "Scheduler started (max_concurrent=%d, paused=%s)",
            self._max_concurrent,
            self._paused,
        )

    # ── capacity (synchronous = atomic in the event loop) ───────────────

    def _try_acquire(self) -> bool:
        if self._available > 0:
            self._available -= 1
            self._in_flight += 1
            return True
        return False

    def _release(self) -> None:
        self._in_flight -= 1
        if self._available < self._max_concurrent:
            self._available += 1

    # ── task registration ───────────────────────────────────────────────

    async def register_task(self, task_id: str) -> None:
        """(Re-)register a task's timer; skips inactive / non-schedulable modes."""
        if self._scheduler.get_job(task_id):
            self._scheduler.remove_job(task_id)
        task = await self._db.fetch_one(
            "SELECT id, is_active, analysis_mode, schedule_rrule FROM analysis_tasks WHERE id = ?",
            (task_id,),
        )
        if task is None or not task["is_active"]:
            return
        if not may_register_trigger(task["analysis_mode"]):
            return
        schedule_rrule = task.get("schedule_rrule")
        if not schedule_rrule:
            return
        try:
            trigger = schedule_trigger_from_rrule(str(schedule_rrule))
        except (ValueError, KeyError, ScheduleValidationError) as exc:
            logger.error("Invalid schedule for task %s: %s", task_id, exc)
            return
        self._scheduler.add_job(
            self._on_timer_fire,
            trigger=trigger,
            id=task_id,
            args=[task_id],
            replace_existing=True,
        )
        logger.info("Registered timer for task %s (%s)", task_id, schedule_rrule)

    async def unregister_task(self, task_id: str) -> None:
        if self._scheduler.get_job(task_id):
            self._scheduler.remove_job(task_id)
            logger.info("Unregistered timer for task %s", task_id)

    async def _register_all_active_tasks(self) -> None:
        modes = tuple(sorted(SCHEDULABLE_ANALYSIS_MODES))
        placeholders = ",".join("?" for _ in modes)
        tasks = await self._db.fetch_all(
            f"SELECT id FROM analysis_tasks WHERE is_active = 1 AND analysis_mode IN ({placeholders})",
            modes,
        )
        for task in tasks:
            try:
                await self.register_task(str(task["id"]))
            except Exception:  # noqa: BLE001 — one bad task must not block the rest
                logger.exception("Failed to register task %s", task["id"])

    # ── dispatch ────────────────────────────────────────────────────────

    def _task_is_pending(self, task_id: str) -> bool:
        return task_id in self._in_flight_tasks.values() or any(
            queued.task_id == task_id for queued in self._wait_queue
        )

    async def _on_timer_fire(self, task_id: str) -> None:
        if self._paused or self._task_is_pending(task_id):
            return
        if self._try_acquire():
            self._spawn_batch(task_id)
        else:
            self._wait_queue.append(_QueuedTask(task_id=task_id, enqueued_at=time.monotonic()))
            self._dispatch_event.set()

    def _spawn_batch(self, task_id: str) -> None:
        task = asyncio.create_task(self._execute_scheduled(task_id))
        self._in_flight_tasks[task] = task_id
        task.add_done_callback(lambda t: self._in_flight_tasks.pop(t, None))

    async def _dispatch_queue_worker(self) -> None:
        try:
            while True:
                await self._dispatch_event.wait()
                self._dispatch_event.clear()
                while self._wait_queue and not self._paused:
                    if self._try_acquire():
                        queued = self._wait_queue.popleft()
                        self._spawn_batch(queued.task_id)
                    else:
                        break
        except asyncio.CancelledError:
            pass

    async def _execute_scheduled(self, task_id: str) -> None:
        try:
            row = await self._db.fetch_one(
                "SELECT analysis_mode FROM analysis_tasks WHERE id = ?",
                (task_id,),
            )
            mode = str((row or {}).get("analysis_mode") or "")
            spec = get_analysis_mode_spec(mode)
            if spec is not None and spec.pipeline == "project_tick":
                await execute_project_tick(
                    db=self._db,
                    broadcaster=self._broadcaster,
                    task_id=task_id,
                    analysis_paused=self._paused,
                )
            elif spec is not None and spec.pipeline == "web_intel_tick":
                await execute_web_intel_tick(
                    db=self._db,
                    broadcaster=self._broadcaster,
                    task_id=task_id,
                    analysis_paused=self._paused,
                    scheduler=self,
                )
            else:
                await execute_batch(
                    db=self._db,
                    broadcaster=self._broadcaster,
                    task_id=task_id,
                    analysis_engine=self._analysis_engine,
                    action_executor=self._action_executor,
                    analysis_paused=self._paused,
                    scheduler=self,
                )
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — capacity must always be released
            logger.exception("Scheduled execution failed for task %s", task_id)
        finally:
            self._release()
            if self._in_flight == 0 and self._drain_event is not None:
                self._drain_event.set()
            self._dispatch_event.set()

    # ── pause / resume / concurrency ────────────────────────────────────

    async def pause(self) -> None:
        self._paused = True
        if self._started:
            self._scheduler.pause()
        logger.info("Scheduler paused")

    async def resume(self) -> None:
        self._paused = False
        if self._started:
            self._scheduler.resume()
        await self._register_all_active_tasks()
        self._dispatch_event.set()
        logger.info("Scheduler resumed")

    async def update_concurrency_limit(self, new_limit: int) -> None:
        new_limit = max(1, min(10, new_limit))
        delta = new_limit - self._max_concurrent
        self._max_concurrent = new_limit
        self._available = max(0, self._available + delta)
        self._available = min(self._available, max(0, self._max_concurrent - self._in_flight))
        self._dispatch_event.set()
        logger.info("Updated concurrency limit to %d", new_limit)

    async def abort_in_flight(
        self,
        db: Database | None = None,
    ) -> tuple[list[str], list[str]]:
        """Cancel running batches; optionally delete processing rows.

        Returns ``(aborted_task_ids, aborted_batch_ids)``.
        """
        snapshot = list(self._in_flight_tasks.items())
        aborted: list[str] = []
        cancelled: list[asyncio.Task[None]] = []
        for task, task_id in snapshot:
            if task.done():
                continue
            task.cancel()
            cancelled.append(task)
            aborted.append(task_id)
        if cancelled:
            await asyncio.gather(*cancelled, return_exceptions=True)

        batch_ids: list[str] = []
        if db is not None:
            from server.analysis_control import delete_processing_batches

            batch_ids = await delete_processing_batches(db)
        return aborted, batch_ids

    # ── shutdown ────────────────────────────────────────────────────────

    async def shutdown(self) -> None:
        self._paused = True
        if self._started:
            self._scheduler.shutdown(wait=False)
        for task in (self._dispatch_task, self._retention_task):
            if task is not None:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        if self._in_flight > 0:
            self._drain_event = asyncio.Event()
            try:
                await asyncio.wait_for(self._drain_event.wait(), timeout=_SHUTDOWN_GRACE_SECONDS)
            except asyncio.TimeoutError:
                logger.warning("Shutdown grace expired with %d batches in flight", self._in_flight)
                await self.abort_in_flight(self._db)
        self._wait_queue.clear()
        logger.info("Scheduler shut down")

    # ── introspection ───────────────────────────────────────────────────

    @property
    def paused(self) -> bool:
        return self._paused

    @property
    def max_concurrent(self) -> int:
        return self._max_concurrent

    @property
    def in_flight(self) -> int:
        return self._in_flight

    @property
    def queue_size(self) -> int:
        return len(self._wait_queue)

    async def _load_max_concurrent(self) -> int:
        return await get_config_int(self._db, "max_concurrent_batches")

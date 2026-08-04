"""Failing-before regressions for managed-task shutdown ordering.

These tests deliberately describe the required close order. On the pre-fix
implementation, the geocode, scheduler-timeout, and deferred-retry examples
fail and provide the lifecycle event trace as their counterexample.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any, Coroutine

import server.analysis_control as analysis_control
import server.analyzer.geocoding as geocoding
import server.main as main_module
import server.scheduler.manager as scheduler_module
from server.collector.manager import CollectorManager
from server.db.database import Database
from server.scheduler.manager import SchedulerManager
from server.sse import SseBroadcaster


def _assert_precedes(events: list[str], before: str, after: str) -> None:
    assert before in events, f"missing {before!r}; lifecycle events: {events!r}"
    assert after in events, f"missing {after!r}; lifecycle events: {events!r}"
    assert events.index(before) < events.index(after), (
        f"expected {before!r} before {after!r}; lifecycle events: {events!r}"
    )


async def _cancel_and_drain(tasks: list[asyncio.Task[None]]) -> None:
    for task in tasks:
        if not task.done():
            task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.sleep(0)


class _RecordingAdapter:
    def __init__(self, events: list[str]) -> None:
        self._events = events

    async def disconnect(self) -> None:
        self._events.append("adapter:disconnect")


async def test_lifespan_awaits_blocked_geocode_before_database_close(tmp_path, monkeypatch):
    """The lifespan must own and drain geocode work before closing its DB."""
    events: list[str] = []
    backfill_entered = asyncio.Event()
    backfill_release = asyncio.Event()
    owned_tasks: list[asyncio.Task[None]] = []

    async def blocked_backfill(_db: Database) -> int:
        events.append("backfill:started")
        backfill_entered.set()
        try:
            await backfill_release.wait()
            return 0
        except asyncio.CancelledError:
            events.append("backfill:cancelled")
            raise
        finally:
            events.append("backfill:done")

    real_create_task = asyncio.create_task

    def recording_create_task(coro: Coroutine[Any, Any, None]) -> asyncio.Task[None]:
        task = real_create_task(coro)
        owned_tasks.append(task)
        return task

    real_close = Database.close

    async def recording_close(db: Database) -> None:
        events.append("database:close")
        await real_close(db)

    monkeypatch.setattr(geocoding, "backfill_stored_events", blocked_backfill)
    monkeypatch.setattr(main_module, "STARTUP_DB_SETTLE_SECONDS", 0)
    monkeypatch.setattr(
        main_module,
        "asyncio",
        SimpleNamespace(create_task=recording_create_task, sleep=asyncio.sleep),
    )
    monkeypatch.setattr(Database, "close", recording_close)

    app = main_module.create_app(
        db_path=str(tmp_path / "lifecycle-close-order.db"),
        start_collector=False,
        start_scheduler=False,
        serve_static=False,
    )
    try:
        async with app.router.lifespan_context(app):
            await asyncio.wait_for(backfill_entered.wait(), timeout=1)
    finally:
        await _cancel_and_drain(owned_tasks)

    _assert_precedes(events, "backfill:cancelled", "database:close")
    _assert_precedes(events, "backfill:done", "database:close")


async def _start_blocked_scheduler_batch(
    manager: SchedulerManager,
    monkeypatch,
    events: list[str],
) -> tuple[asyncio.Task[None], asyncio.Event]:
    entered = asyncio.Event()
    release = asyncio.Event()

    async def blocked_execute_batch(**_kwargs) -> None:
        events.append("batch:started")
        entered.set()
        try:
            await release.wait()
        except asyncio.CancelledError:
            events.append("batch:cancelled")
            raise
        finally:
            events.append("batch:done")

    async def fake_fetch_one(*_args, **_kwargs):
        # Non-project mode so `_execute_scheduled` routes to execute_batch.
        return {"analysis_mode": "intel_event"}

    monkeypatch.setattr(scheduler_module, "execute_batch", blocked_execute_batch)
    manager._db = SimpleNamespace(fetch_one=fake_fetch_one)  # type: ignore[assignment]
    assert manager._try_acquire()
    manager._spawn_batch("blocked-task")
    task = next(iter(manager._in_flight_tasks))
    await asyncio.wait_for(entered.wait(), timeout=1)
    return task, release


async def test_scheduler_grace_completion_uses_fake_wait_without_wall_clock_sleep(monkeypatch):
    """A batch completing in grace drains normally without a 30-second sleep."""
    events: list[str] = []
    manager = SchedulerManager(object(), analysis_engine=None, broadcaster=SseBroadcaster())  # type: ignore[arg-type]
    task, release = await _start_blocked_scheduler_batch(manager, monkeypatch, events)
    observed_timeouts: list[float] = []

    async def complete_during_grace(awaitable, *, timeout: float):
        observed_timeouts.append(timeout)
        release.set()
        return await awaitable

    monkeypatch.setattr(
        scheduler_module,
        "asyncio",
        SimpleNamespace(
            CancelledError=asyncio.CancelledError,
            Event=asyncio.Event,
            TimeoutError=asyncio.TimeoutError,
            create_task=asyncio.create_task,
            gather=asyncio.gather,
            wait_for=complete_during_grace,
        ),
    )

    await manager.shutdown()
    await asyncio.sleep(0)

    assert observed_timeouts == [scheduler_module._SHUTDOWN_GRACE_SECONDS]
    assert task.done()
    assert manager.in_flight == 0
    assert not manager._in_flight_tasks
    assert events == ["batch:started", "batch:done"]


async def test_scheduler_timeout_cancels_and_awaits_before_invalidation_and_close(monkeypatch):
    """Timeout must abort batches before invalidating rows or closing the DB."""
    events: list[str] = []
    manager = SchedulerManager(object(), analysis_engine=None, broadcaster=SseBroadcaster())  # type: ignore[arg-type]
    task, _release = await _start_blocked_scheduler_batch(manager, monkeypatch, events)
    observed_timeouts: list[float] = []

    async def immediate_timeout(awaitable, *, timeout: float):
        observed_timeouts.append(timeout)
        awaitable.close()
        raise asyncio.TimeoutError

    async def recording_invalidation(_db) -> list[str]:
        events.append("processing:invalidate")
        return ["blocked-batch"]

    monkeypatch.setattr(analysis_control, "delete_processing_batches", recording_invalidation)
    monkeypatch.setattr(
        scheduler_module,
        "asyncio",
        SimpleNamespace(
            CancelledError=asyncio.CancelledError,
            Event=asyncio.Event,
            TimeoutError=asyncio.TimeoutError,
            create_task=asyncio.create_task,
            gather=asyncio.gather,
            wait_for=immediate_timeout,
        ),
    )

    try:
        await manager.shutdown()
        events.append("database:close")
    finally:
        await _cancel_and_drain([task])

    assert observed_timeouts == [scheduler_module._SHUTDOWN_GRACE_SECONDS]
    assert task.done()
    assert manager.in_flight == 0
    assert not manager._in_flight_tasks
    _assert_precedes(events, "batch:cancelled", "processing:invalidate")
    _assert_precedes(events, "batch:done", "processing:invalidate")
    _assert_precedes(events, "batch:done", "database:close")


async def test_collector_awaits_active_auto_connect_before_adapter_disconnect(app):
    """Collector shutdown drains its active auto-connect owner first."""
    events: list[str] = []
    entered = asyncio.Event()
    blocker = asyncio.Event()

    async def active_auto_connect() -> None:
        events.append("auto-connect:started")
        entered.set()
        try:
            await blocker.wait()
        except asyncio.CancelledError:
            events.append("auto-connect:cancelled")
            raise
        finally:
            events.append("auto-connect:done")

    manager = CollectorManager(app.state.db, app.state.broadcaster)
    manager._adapters = {"active": _RecordingAdapter(events)}  # type: ignore[dict-item]
    auto_connect_task = asyncio.create_task(active_auto_connect())
    manager._retry_orchestrator._auto_connect_task = auto_connect_task  # noqa: SLF001 — ownership fixture
    await asyncio.wait_for(entered.wait(), timeout=1)

    await manager.shutdown()

    assert auto_connect_task.done()
    assert manager._retry_orchestrator.active_task_count == 0
    _assert_precedes(events, "auto-connect:cancelled", "adapter:disconnect")
    _assert_precedes(events, "auto-connect:done", "adapter:disconnect")


async def test_collector_awaits_deferred_retry_before_adapter_disconnect(app):
    """Collector shutdown must not clear retry ownership before task cleanup."""
    events: list[str] = []
    entered = asyncio.Event()
    blocker = asyncio.Event()
    cleanup_entered = asyncio.Event()
    cleanup_release = asyncio.Event()

    async def active_deferred_retry() -> None:
        events.append("retry:started")
        entered.set()
        try:
            await blocker.wait()
        except asyncio.CancelledError:
            events.append("retry:cancelled")
            cleanup_entered.set()
            # Cancellation cleanup remains active until the fixture releases it.
            # A correct shutdown awaits this point before adapter disconnect.
            await cleanup_release.wait()
            raise
        finally:
            events.append("retry:done")

    manager = CollectorManager(app.state.db, app.state.broadcaster)
    manager._adapters = {"retrying": _RecordingAdapter(events)}  # type: ignore[dict-item]
    retry_task = asyncio.create_task(active_deferred_retry())
    manager._retry_orchestrator._retry_tasks = {"retrying": retry_task}  # noqa: SLF001 — ownership fixture
    await asyncio.wait_for(entered.wait(), timeout=1)

    shutdown_task = asyncio.create_task(manager.shutdown())
    try:
        await asyncio.wait_for(cleanup_entered.wait(), timeout=1)
        # Give an implementation that merely cancels/clears one turn to begin
        # dependency disconnect while retry cleanup is still blocked.
        await asyncio.sleep(0)
        cleanup_release.set()
        await asyncio.wait_for(shutdown_task, timeout=1)
    finally:
        cleanup_release.set()
        await _cancel_and_drain([shutdown_task, retry_task])

    assert retry_task.done()
    assert manager._retry_orchestrator.active_task_count == 0
    _assert_precedes(events, "retry:cancelled", "adapter:disconnect")
    _assert_precedes(events, "retry:done", "adapter:disconnect")

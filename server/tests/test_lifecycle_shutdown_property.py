"""Generated managed-task drain contract shared by lifecycle owners."""

from __future__ import annotations

import asyncio
from typing import Any, cast

from hypothesis import given, settings
from hypothesis import strategies as st

from server.collector.manager_retry import CollectorRetryOrchestrator
from server.tests.property_strategies import property_trace

_OWNER_TYPES = ("lifespan", "scheduler", "collector")
_TASK_MODES = ("immediate", "blocked", "cancelled", "failing")


async def _publish_status(**_kwargs: str) -> None:
    return None


async def _owned_task(index: int, mode: str, events: list[str], blocker: asyncio.Event) -> None:
    events.append(f"task:{index}:started")
    try:
        if mode == "blocked":
            await blocker.wait()
        elif mode == "cancelled":
            raise asyncio.CancelledError
        elif mode == "failing":
            raise RuntimeError(f"generated failure {index}")
    finally:
        events.append(f"task:{index}:done")


@property_trace(4)
@settings(max_examples=100, deadline=None)
@given(
    owner_type=st.sampled_from(_OWNER_TYPES),
    modes=st.lists(st.sampled_from(_TASK_MODES), min_size=0, max_size=6),
    shutdown_interleaving=st.integers(min_value=0, max_value=2),
)
async def test_managed_task_drain_precedes_dependent_resource_closure(
    owner_type: str,
    modes: list[str],
    shutdown_interleaving: int,
) -> None:
    """Generated task inventories obey the cross-owner shutdown contract.

    Fixed integration examples exercise each concrete lifespan/scheduler/collector
    owner; this property broadens task outcomes and shutdown interleavings.

    """
    events: list[str] = []
    blocker = asyncio.Event()
    owner = CollectorRetryOrchestrator(
        cast(Any, object()),
        cast(Any, object()),
        {},
        lambda: "unused",
        _publish_status,
    )
    tasks = [asyncio.create_task(_owned_task(index, mode, events, blocker)) for index, mode in enumerate(modes)]
    if tasks:
        owner._auto_connect_task = tasks[0]  # noqa: SLF001 — generated owner inventory
        owner._retry_tasks = {str(index): task for index, task in enumerate(tasks[1:], start=1)}  # noqa: SLF001

    for _ in range(shutdown_interleaving + 1):
        await asyncio.sleep(0)
    await owner.shutdown()
    events.append(f"{owner_type}:close")

    owner.schedule_retry({"id": "rejected", "platform": "rss", "credentials": {}})
    assert owner.active_task_count == 0
    assert all(task.done() for task in tasks)
    assert events.count(f"{owner_type}:close") == 1
    for index in range(len(tasks)):
        done_event = f"task:{index}:done"
        assert events.count(done_event) == 1
        assert events.index(done_event) < events.index(f"{owner_type}:close")

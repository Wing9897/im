"""Property coverage for identity-safe collector retry ownership."""

from __future__ import annotations

from typing import Any, cast

from hypothesis import given, settings
from hypothesis import strategies as st

from server.collector.manager_retry import CollectorRetryOrchestrator
from server.tests.property_strategies import property_trace


@property_trace(5)
@settings(max_examples=100)
@given(
    source_id=st.text(min_size=1, max_size=24),
    old_completes_first=st.booleans(),
)
def test_retry_handle_cleanup_is_identity_safe(source_id: str, old_completes_first: bool) -> None:
    """A stale completion callback never removes its replacement handle."""
    owner = cast(Any, object.__new__(CollectorRetryOrchestrator))
    old_task = object()
    replacement_task = object()
    owner._retry_tasks = {source_id: replacement_task}

    callbacks = [old_task, replacement_task]
    if not old_completes_first:
        callbacks.reverse()

    for completed in callbacks:
        owner._remove_retry(source_id, completed)
        if completed is old_task and replacement_task not in callbacks[: callbacks.index(completed)]:
            assert owner._retry_tasks[source_id] is replacement_task

    assert source_id not in owner._retry_tasks

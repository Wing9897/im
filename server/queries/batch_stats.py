"""Shared batch-count helpers for stats queries."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from server.queries.version_sql import task_version_join

_QUEUED_STATUSES = frozenset({"pending", "processing"})


def sum_queued_message_count(batches: Iterable[Mapping[str, Any]]) -> int:
    return sum(int(batch.get("message_count") or 0) for batch in batches if batch.get("status") in _QUEUED_STATUSES)


async def count_pending_current_batches(db: Any) -> int:
    """Count pending batches associated with each task's current version."""
    return int(
        await db.fetch_value(
            f"SELECT COUNT(*) FROM analysis_batches b {task_version_join('b')} WHERE b.status = 'pending'"
        )
        or 0
    )

"""Channel refs attached to a task row."""

from __future__ import annotations

from typing import Any

from server.queries.tasks_queries import fetch_task_channel_rows
from server.wire.serializer_domains.sources import serialize_channel_ref


async def channel_refs_for(db: Any, task_id: str) -> list[dict[str, Any]]:
    rows = await fetch_task_channel_rows(db, task_id)
    return [serialize_channel_ref(row) for row in rows]


__all__ = ["channel_refs_for"]

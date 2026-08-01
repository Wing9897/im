"""Batch claim helpers: load task context and create or resume pending batches."""

from __future__ import annotations

from typing import Any, Optional

from server.analyzer.incremental import (
    MARKER_INSERT_SQL,
    MESSAGE_COLUMNS,
    marker_rows,
)
from server.db.database import Database
from server.util import new_id, utc_now_iso


async def load_task(db: Database, task_id: str) -> Optional[dict[str, Any]]:
    return await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))


async def task_has_channels(db: Database, task_id: str) -> bool:
    value = await db.fetch_value("SELECT COUNT(*) FROM task_channels WHERE task_id = ?", (task_id,))
    return int(value or 0) > 0


async def find_pending_batch(db: Database, task_id: str, version: int) -> Optional[dict[str, Any]]:
    return await db.fetch_one(
        "SELECT * FROM analysis_batches "
        "WHERE task_id = ? AND version = ? AND status = 'pending' "
        "ORDER BY created_at ASC LIMIT 1",
        (task_id, version),
    )


async def fetch_batch_messages(db: Database, batch_id: str) -> list[dict[str, Any]]:
    select_cols = ", ".join(f"m.{col}" for col in MESSAGE_COLUMNS)
    return await db.fetch_all(
        f"SELECT {select_cols} FROM messages m "
        "JOIN analysis_markers am ON am.message_id = m.id "
        "WHERE am.batch_id = ? ORDER BY m.timestamp ASC, m.id ASC",
        (batch_id,),
    )


async def batch_channel_names(db: Database, batch_id: str) -> list[str]:
    rows = await db.fetch_all(
        "SELECT DISTINCT c.channel_name FROM channels c "
        "JOIN messages m ON m.platform = c.platform AND m.platform_id = c.platform_id "
        "JOIN analysis_markers am ON am.message_id = m.id "
        "WHERE am.batch_id = ? AND c.channel_name IS NOT NULL",
        (batch_id,),
    )
    return sorted(str(row["channel_name"]) for row in rows)


async def create_batch_with_markers(db: Database, task: dict[str, Any], messages: list[dict[str, Any]]) -> str:
    """Create the batch row and claim its messages (single transaction)."""
    batch_id = new_id()
    now = utc_now_iso()
    version = int(task.get("version") or 1)
    async with db.transaction() as conn:
        await conn.execute(
            "INSERT INTO analysis_batches "
            "(id, task_id, version, status, message_count, created_at, updated_at) "
            "VALUES (?, ?, ?, 'pending', ?, ?, ?)",
            (batch_id, str(task["id"]), version, len(messages), now, now),
        )
        rows = marker_rows(batch_id, str(task["id"]), version, [m["id"] for m in messages])
        await conn.executemany(MARKER_INSERT_SQL, rows)
    return batch_id

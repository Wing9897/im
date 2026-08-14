"""Cross-batch message overlap context (previous batch tail).

Returns [] for leaderboard mode, non-positive overlap counts, no prior
completed batch, or on any fetch error — overlap must never fail a batch.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from server.analyzer.incremental import MESSAGE_COLUMNS
from server.db.database import Database
from server.domain.analysis_modes import LEADERBOARD_MODE
from server.util import task_value

logger = logging.getLogger(__name__)


async def _latest_completed_batch_id(db: Database, task_id: str) -> str | None:
    row = await db.fetch_one(
        "SELECT id FROM analysis_batches "
        "WHERE task_id = ? AND status = 'completed' "
        "ORDER BY completed_at DESC, created_at DESC, id DESC LIMIT 1",
        (task_id,),
    )
    return None if row is None else str(row["id"])


async def fetch_overlap_context(
    db: Database,
    task: Mapping[str, Any] | Any,
    overlap_count: int,
) -> list[dict[str, Any]]:
    """Tail of the most recent completed batch, timestamp ascending."""
    try:
        mode = task_value(task, "analysis_mode")
        if isinstance(mode, str) and mode == LEADERBOARD_MODE:
            return []
        try:
            count = int(overlap_count)
        except (TypeError, ValueError):
            return []
        if count <= 0:
            return []

        task_id = str(task_value(task, "id") or "")
        if not task_id:
            return []

        batch_id = await _latest_completed_batch_id(db, task_id)
        if batch_id is None:
            return []

        select_cols = ", ".join(f"m.{col}" for col in MESSAGE_COLUMNS)
        rows = await db.fetch_all(
            f"SELECT {select_cols} FROM messages m "
            "JOIN analysis_markers am ON am.message_id = m.id "
            "WHERE am.batch_id = ? AND am.task_id = ? "
            "ORDER BY m.timestamp DESC, m.id DESC LIMIT ?",
            (batch_id, task_id, count),
        )
        rows.reverse()
        return rows
    except Exception:  # noqa: BLE001 — overlap failure must not fail the batch
        logger.warning(
            "fetch_overlap_context failed; continuing with empty context",
            exc_info=True,
        )
        return []

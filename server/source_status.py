"""Shared source status persistence for API routes and collector adapters."""

from __future__ import annotations

import logging
from typing import Any

from server.app_logging import record, summarize_error_message
from server.util import utc_now_iso

logger = logging.getLogger(__name__)


async def mark_source_connected(db: Any, source_id: str, *, name: str | None = None) -> None:
    """Persist connected status (optionally renaming the source)."""
    now = utc_now_iso()
    if name is None:
        await db.execute(
            "UPDATE sources SET status = 'connected', last_error = NULL, "
            "last_connected_at = ?, updated_at = ? WHERE id = ?",
            (now, now, source_id),
        )
    else:
        await db.execute(
            "UPDATE sources SET status = 'connected', last_error = NULL, name = ?, "
            "last_connected_at = ?, updated_at = ? WHERE id = ?",
            (name, now, now, source_id),
        )


async def _record_source_error(db: Any, source_id: str, error: str) -> None:
    """Best-effort Settings→Logs row for source connect / runtime failures."""
    try:
        row = await db.fetch_one(
            "SELECT name, platform FROM sources WHERE id = ?",
            (source_id,),
        )
        source_name = str(row["name"]) if row and row.get("name") else source_id
        platform = str(row["platform"]) if row and row.get("platform") else "unknown"
        summary = summarize_error_message(error)
        await record(
            db,
            level="error",
            category="source",
            kind="source.error",
            message=f"Source error ({platform}): {source_name} — {summary}",
            message_key="logs:templates.sourceError",
            message_params={
                "sourceName": source_name,
                "platform": platform,
                "summary": summary,
            },
            source="server.source_status",
            payload={
                "sourceId": source_id,
                "sourceName": source_name,
                "platform": platform,
                "error": error,
            },
        )
    except Exception:  # noqa: BLE001 — logging must never block status updates
        logger.exception("Failed to record source.error app log for %s", source_id)


async def set_source_error(db: Any, source_id: str, error: str) -> None:
    await db.execute(
        "UPDATE sources SET status = 'error', last_error = ?, updated_at = ? WHERE id = ?",
        (error, utc_now_iso(), source_id),
    )
    await _record_source_error(db, source_id, error)


async def update_source_status(
    db: Any,
    source_id: str,
    status: str,
    *,
    last_error: str | None = None,
) -> None:
    """Best-effort persist used by collector adapters during reconnect loops."""
    now = utc_now_iso()
    previous = await db.fetch_one(
        "SELECT status FROM sources WHERE id = ?",
        (source_id,),
    )
    previous_status = str(previous["status"]) if previous else None
    if status == "connected":
        await db.execute(
            "UPDATE sources SET status = ?, last_error = NULL, last_connected_at = ?, updated_at = ? WHERE id = ?",
            (status, now, now, source_id),
        )
    else:
        await db.execute(
            "UPDATE sources SET status = ?, last_error = ?, updated_at = ? WHERE id = ?",
            (status, last_error, now, source_id),
        )
    # Log only on transition into error (poll/reconnect loops can re-set error).
    if status == "error" and last_error and previous_status != "error":
        await _record_source_error(db, source_id, last_error)

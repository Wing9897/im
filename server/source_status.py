"""Shared source status persistence for API routes and collector adapters."""

from __future__ import annotations

import logging
from typing import Any

from server.app_logging import record, summarize_error_message
from server.domain.source_statuses import SOURCE_STATUS_CONNECTED, SOURCE_STATUS_ERROR
from server.queries import sources_queries
from server.util import utc_now_iso

logger = logging.getLogger(__name__)


async def mark_source_connected(db: Any, source_id: str, *, name: str | None = None) -> None:
    """Persist connected status (optionally renaming the source)."""
    now = utc_now_iso()
    await sources_queries.update_source_status(db, source_id, SOURCE_STATUS_CONNECTED, name=name, now=now)


async def _record_source_error(db: Any, source_id: str, error: str) -> None:
    """Best-effort Settings→Logs row for source connect / runtime failures."""
    try:
        row = await sources_queries.fetch_source_name_platform(db, source_id)
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
    await sources_queries.update_source_status(db, source_id, SOURCE_STATUS_ERROR, last_error=error)
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
    previous = await sources_queries.fetch_source_status(db, source_id)
    previous_status = str(previous["status"]) if previous else None
    await sources_queries.update_source_status(
        db,
        source_id,
        status,
        last_error=last_error,
        now=now,
    )
    # Log only on transition into error (poll/reconnect loops can re-set error).
    if status == SOURCE_STATUS_ERROR and last_error and previous_status != SOURCE_STATUS_ERROR:
        await _record_source_error(db, source_id, last_error)

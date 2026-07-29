"""Data-retention cleanup executor.

Independent category TTLs (0 disables that category):
  - retention_messages_days → messages (+ analysis_markers; FK SET NULL on results)
  - retention_analysis_days → analysis_events + completed analysis_batches
  - retention_leaderboard_days → trending_topics (CASCADE topic_messages)
  - retention_app_logs_days → app_logs
  - retention_user_events_days → user_events

``action_trigger_history`` follows the messages TTL.

Always-on (not gated by retention_*_days):
  - orphan ``timeline_dismissals`` (source event row gone)
  - stale ``assistant_device_stores`` by ``updated_at`` (fixed TTL)
  - device session / access-token rows by their own ``expires_at``
  - ``a2a_audit_log`` by ``created_at`` (fixed TTL)
"""

from __future__ import annotations

import asyncio
import logging
from typing import TypedDict

from server.config import get_config_int
from server.db.database import Database
from server.queries.retention_queries import (
    cleanup_a2a_audit_log_batch,
    cleanup_action_trigger_history_batch,
    cleanup_analysis_batch,
    cleanup_app_logs_batch,
    cleanup_assistant_stores_batch,
    cleanup_completed_batches_batch,
    cleanup_device_access_tokens_batch,
    cleanup_device_sessions_batch,
    cleanup_leaderboard_batch,
    cleanup_messages_batch,
    cleanup_orphan_timeline_dismissals_batch,
    cleanup_user_events_batch,
)

logger = logging.getLogger(__name__)

CLEANUP_INTERVAL_SECONDS = 24 * 3600
# Fixed TTL for per-device assistant session blobs (no settings key).
ASSISTANT_STORE_TTL_DAYS = 90
# Fixed TTL for the A2A call audit trail (no settings key). One row per external
# agent call, so without a TTL the table is the only unbounded table left.
A2A_AUDIT_TTL_DAYS = 180


class RetentionCounts(TypedDict):
    messages: int
    analysis: int
    leaderboard: int
    action_trigger_history: int
    app_logs: int
    user_events: int
    timeline_dismissals: int
    assistant_device_stores: int
    device_access_tokens: int
    device_sessions: int
    a2a_audit_log: int


def _cutoff(days: int) -> str:
    return f"-{days} days"


async def cleanup_expired_data(db: Database) -> RetentionCounts:
    """Run one full cleanup pass; returns per-category delete counts."""
    counts: RetentionCounts = {
        "messages": 0,
        "analysis": 0,
        "leaderboard": 0,
        "action_trigger_history": 0,
        "app_logs": 0,
        "user_events": 0,
        "timeline_dismissals": 0,
        "assistant_device_stores": 0,
        "device_access_tokens": 0,
        "device_sessions": 0,
        "a2a_audit_log": 0,
    }

    messages_days = await get_config_int(db, "retention_messages_days")
    if messages_days > 0:
        cutoff = _cutoff(messages_days)
        while True:
            deleted = await cleanup_messages_batch(db, cutoff)
            counts["messages"] += deleted
            if deleted == 0:
                break
            await asyncio.sleep(0)
        while True:
            deleted = await cleanup_action_trigger_history_batch(db, cutoff)
            counts["action_trigger_history"] += deleted
            if deleted == 0:
                break
            await asyncio.sleep(0)

    analysis_days = await get_config_int(db, "retention_analysis_days")
    if analysis_days > 0:
        cutoff = _cutoff(analysis_days)
        while True:
            deleted = await cleanup_analysis_batch(db, cutoff)
            counts["analysis"] += deleted
            if deleted == 0:
                break
            await asyncio.sleep(0)
        while True:
            deleted = await cleanup_completed_batches_batch(db, cutoff)
            counts["analysis"] += deleted
            if deleted == 0:
                break
            await asyncio.sleep(0)

    leaderboard_days = await get_config_int(db, "retention_leaderboard_days")
    if leaderboard_days > 0:
        cutoff = _cutoff(leaderboard_days)
        while True:
            deleted = await cleanup_leaderboard_batch(db, cutoff)
            counts["leaderboard"] += deleted
            if deleted == 0:
                break
            await asyncio.sleep(0)

    app_logs_days = await get_config_int(db, "retention_app_logs_days")
    if app_logs_days > 0:
        cutoff = _cutoff(app_logs_days)
        while True:
            deleted = await cleanup_app_logs_batch(db, cutoff)
            counts["app_logs"] += deleted
            if deleted == 0:
                break
            await asyncio.sleep(0)

    user_events_days = await get_config_int(db, "retention_user_events_days")
    if user_events_days > 0:
        cutoff = _cutoff(user_events_days)
        while True:
            deleted = await cleanup_user_events_batch(db, cutoff)
            counts["user_events"] += deleted
            if deleted == 0:
                break
            await asyncio.sleep(0)

    # Always on: orphan dismissals after source rows age out / are deleted.
    while True:
        deleted = await cleanup_orphan_timeline_dismissals_batch(db)
        counts["timeline_dismissals"] += deleted
        if deleted == 0:
            break
        await asyncio.sleep(0)

    # Always on: assistant device stores past the fixed TTL.
    while True:
        deleted = await cleanup_assistant_stores_batch(db, _cutoff(ASSISTANT_STORE_TTL_DAYS))
        counts["assistant_device_stores"] += deleted
        if deleted == 0:
            break
        await asyncio.sleep(0)

    # Always on: these rows expire by their own TTL, not by a configured
    # retention window. Tokens are drained before sessions so the session FK
    # cascade never swallows rows that belong in the token count.
    while True:
        deleted = await cleanup_device_access_tokens_batch(db)
        counts["device_access_tokens"] += deleted
        if deleted == 0:
            break
        await asyncio.sleep(0)

    while True:
        deleted = await cleanup_device_sessions_batch(db)
        counts["device_sessions"] += deleted
        if deleted == 0:
            break
        await asyncio.sleep(0)

    # Always on: the A2A audit trail past its fixed TTL.
    while True:
        deleted = await cleanup_a2a_audit_log_batch(db, _cutoff(A2A_AUDIT_TTL_DAYS))
        counts["a2a_audit_log"] += deleted
        if deleted == 0:
            break
        await asyncio.sleep(0)

    if any(counts.values()):
        logger.info(
            "Retention cleanup removed messages=%d analysis=%d leaderboard=%d "
            "action_trigger_history=%d app_logs=%d user_events=%d "
            "timeline_dismissals=%d assistant_device_stores=%d "
            "device_access_tokens=%d device_sessions=%d a2a_audit_log=%d",
            counts["messages"],
            counts["analysis"],
            counts["leaderboard"],
            counts["action_trigger_history"],
            counts["app_logs"],
            counts["user_events"],
            counts["timeline_dismissals"],
            counts["assistant_device_stores"],
            counts["device_access_tokens"],
            counts["device_sessions"],
            counts["a2a_audit_log"],
        )
    return counts


async def retention_timer(db: Database) -> None:
    """Background loop: startup cleanup, then one pass every 24 hours."""
    try:
        await cleanup_expired_data(db)
    except Exception:  # noqa: BLE001 — cleanup must never kill the loop
        logger.exception("Startup retention cleanup failed")
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            await cleanup_expired_data(db)
        except Exception:  # noqa: BLE001 — cleanup must never kill the loop
            logger.exception("Scheduled retention cleanup failed")

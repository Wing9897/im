"""Background scan: push dirty published worksets about once a minute.

Wall-clock interval (not timezone-aligned cron). Multiple local edits inside
the window collapse to one IC write. Worksets are serialized so IntelligenceCalendar's
10s per-calendar write interval and IM's publish proxy budget are not burst.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from server.calendar_share.dirty import has_live_public_replica
from server.calendar_share.publish import push_workset_calendar_result
from server.calendar_share.store import get_workset_entry, load_workset_map, session_connected, upsert_workset_entry
from server.db.database import Database
from server.errors import AUTH_REQUIRED

logger = logging.getLogger(__name__)

#: Wall-clock scan interval. Edits accumulate until the next tick.
SCAN_INTERVAL_SECONDS = 60.0
#: Space IC writes across worksets. Keep in sync with IntelligenceCalendar
#: ``MIN_WRITE_INTERVAL_SECONDS`` (default 10). Do not lower.
WRITE_SPACING_SECONDS = 10.0

SleepFn = Callable[[float], Awaitable[None]]


def _dirty_published_ids(mapping: dict[str, dict[str, Any]]) -> list[str]:
    return sorted(
        workset_id
        for workset_id, entry in mapping.items()
        if entry.get("pendingSync") and has_live_public_replica(entry)
    )


async def sync_dirty_published_worksets(
    db: Database,
    *,
    spacing_seconds: float = WRITE_SPACING_SECONDS,
    sleep: SleepFn = asyncio.sleep,
) -> list[str]:
    """Push each dirty live replica once. Returns workset ids that synced cleanly.

    Hash-unchanged snapshots clear dirty without an IC write. Failures stay dirty
    and record lastError (no UI toast). Never unpublished, never creates a new
    public calendar for a mapping that has no live replica checkpoint.
    """
    mapping = await load_workset_map(db)
    dirty_ids = _dirty_published_ids(mapping)
    if not dirty_ids:
        return []
    if not await session_connected(db):
        for workset_id in dirty_ids:
            entry = mapping.get(workset_id) or {}
            if str(entry.get("lastError") or "") == AUTH_REQUIRED:
                continue
            await upsert_workset_entry(db, workset_id, {**entry, "lastError": AUTH_REQUIRED})
        return []

    synced: list[str] = []
    wrote_remote = False
    for workset_id in dirty_ids:
        entry = await get_workset_entry(db, workset_id)
        if not entry.get("pendingSync") or not has_live_public_replica(entry):
            continue
        if wrote_remote and spacing_seconds > 0:
            await sleep(spacing_seconds)
        try:
            result = await push_workset_calendar_result(db, workset_id=workset_id, entry=entry)
        except Exception as exc:
            wrote_remote = True
            logger.info("Calendar share autosync failed for %s: %s", workset_id, exc)
            continue
        wrote_remote = wrote_remote or result.wrote_remote
        synced.append(workset_id)
    return synced


async def calendar_share_autosync_loop(db: Database) -> None:
    """Sleep 60s, scan, repeat. First pass waits a full interval after startup."""
    try:
        while True:
            await asyncio.sleep(SCAN_INTERVAL_SECONDS)
            try:
                await sync_dirty_published_worksets(db)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Calendar share autosync scan failed")
    except asyncio.CancelledError:
        logger.info("Calendar share autosync stopped")
        raise

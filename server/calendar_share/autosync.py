"""Background scan: push dirty published worksets on a per-row interval.

Wall-clock intervals (not timezone-aligned cron). Multiple local edits inside
the window collapse to one IC write. Worksets are serialized so IntelligenceCalendar's
10s per-calendar write interval and IM's publish proxy budget are not burst.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from server.calendar_share.auto_sync_config import (
    LOOP_TICK_SECONDS,
    WRITE_SPACING_SECONDS,
    normalize_auto_sync_interval_seconds,
    read_unified_auto_sync,
)
from server.calendar_share.dirty import has_live_public_replica
from server.calendar_share.publish import push_workset_calendar_result
from server.calendar_share.store import get_workset_entry, load_workset_map, session_connected, upsert_workset_entry
from server.db.database import Database
from server.errors import AUTH_REQUIRED

logger = logging.getLogger(__name__)

SleepFn = Callable[[float], Awaitable[None]]

#: First time we observe ``pendingSync`` for a row in this process (lost on restart).
_pending_since: dict[str, datetime] = {}


def reset_auto_sync_pending_since_for_tests() -> None:
    _pending_since.clear()


def _pending_since_for(workset_id: str, entry: dict[str, Any], *, now: datetime) -> datetime | None:
    if not entry.get("pendingSync"):
        _pending_since.pop(workset_id, None)
        return None
    marked = _pending_since.get(workset_id)
    if marked is None:
        marked = now
        _pending_since[workset_id] = marked
    return marked


def auto_sync_interval_elapsed(
    entry: dict[str, Any],
    *,
    workset_id: str = "",
    now: datetime | None = None,
    interval_seconds: int | None = None,
) -> bool:
    """True when a dirty row may auto-push under its configured interval."""
    if not entry.get("autoSync"):
        return False
    if not entry.get("pendingSync"):
        return False
    interval = normalize_auto_sync_interval_seconds(
        interval_seconds if interval_seconds is not None else entry.get("autoSyncIntervalSeconds")
    )
    now_dt = now or datetime.now(UTC)
    wid = str(workset_id or entry.get("worksetId") or "").strip()
    if not wid:
        return True
    marked = _pending_since_for(wid, entry, now=now_dt)
    if marked is None:
        return False
    return (now_dt - marked).total_seconds() >= interval


def _eligible_dirty_published_ids(
    mapping: dict[str, dict[str, Any]],
    *,
    now: datetime | None = None,
    household_on: bool = True,
    interval_seconds: int | None = None,
) -> list[str]:
    if not household_on:
        return []
    now_dt = now or datetime.now(UTC)
    return sorted(
        workset_id
        for workset_id, entry in mapping.items()
        if entry.get("pendingSync")
        and has_live_public_replica(entry)
        and auto_sync_interval_elapsed(entry, workset_id=workset_id, now=now_dt, interval_seconds=interval_seconds)
    )


async def sync_dirty_published_worksets(
    db: Database,
    *,
    spacing_seconds: float = WRITE_SPACING_SECONDS,
    sleep: SleepFn = asyncio.sleep,
    now: datetime | None = None,
) -> list[str]:
    """Push each eligible dirty live replica once. Returns workset ids that synced cleanly.

    Hash-unchanged snapshots clear dirty without an IC write. Failures stay dirty
    and record lastError (no UI toast). Never unpublished, never creates a new
    public calendar for a mapping that has no live replica checkpoint.
    """
    household_on, household_interval = await read_unified_auto_sync(db)
    if not household_on:
        return []
    mapping = await load_workset_map(db)
    dirty_ids = _eligible_dirty_published_ids(
        mapping,
        now=now,
        household_on=household_on,
        interval_seconds=household_interval,
    )
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
        if (
            not entry.get("pendingSync")
            or not has_live_public_replica(entry)
            or not auto_sync_interval_elapsed(
                entry, workset_id=workset_id, now=now, interval_seconds=household_interval
            )
        ):
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
        _pending_since.pop(workset_id, None)
    return synced


async def calendar_share_autosync_loop(db: Database) -> None:
    """Poll on ``LOOP_TICK_SECONDS``, push eligible dirty rows, repeat."""
    try:
        while True:
            await asyncio.sleep(LOOP_TICK_SECONDS)
            try:
                await sync_dirty_published_worksets(db)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Calendar share autosync scan failed")
    except asyncio.CancelledError:
        logger.info("Calendar share autosync stopped")
        raise

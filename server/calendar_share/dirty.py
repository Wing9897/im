"""Persist pendingSync on already-published workset mappings when household auto-sync is on.

Local calendar writes set the flag only when household auto-sync is enabled; the
background autosync loop is the pusher. Unpublished worksets (no live public replica)
are ignored so we never auto-create a remote calendar.

RRULE occurrence dismiss does not set pendingSync: the public snapshot is the
unexpanded ``series[]`` (no exdate upload). Do not treat that as a bug.
"""

from __future__ import annotations

from typing import Any

from server.calendar_share.store import mark_all_live_replicas_pending, mark_workset_pending
from server.db.database import Database
from server.worksets_const import SYSTEM_WORKSET_ID


def has_live_public_replica(entry: dict[str, Any] | None) -> bool:
    """True when this mapping already uploaded a public copy (row + checkpoint)."""
    if not isinstance(entry, dict):
        return False
    if not str(entry.get("slug") or "").strip():
        return False
    if str(entry.get("lastServerEventsHash") or "").strip():
        return True
    return bool(str(entry.get("lastPublicVisibility") or "").strip())


def _row_workset_id(row: dict[str, Any] | None) -> str:
    if not row:
        return SYSTEM_WORKSET_ID
    raw = row.get("workset_id")
    text = str(raw).strip() if raw is not None else ""
    return text or SYSTEM_WORKSET_ID


async def mark_published_workset_dirty(db: Database, *workset_ids: str) -> None:
    """Set pendingSync on live published mappings. No-op for unpublished ids."""
    await mark_workset_pending(db, *workset_ids)


async def mark_all_published_worksets_dirty(db: Database) -> None:
    await mark_all_live_replicas_pending(db)


async def workset_ids_for_timeline_event(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> tuple[str, ...]:
    """Worksets whose published snapshot includes this timeline row.

    Recurring (``source=recurring``) occurrence dismissals are omitted on
    purpose: they do not set pendingSync because the public snapshot uploads
    unexpanded ``series[]``, not expanded occurrences (no exdate).
    """
    src = (source or "").strip()
    eid = (event_id or "").strip()
    if not eid:
        return ()
    if src == "user":
        from server.queries.calendar_queries import fetch_user_event

        row = await fetch_user_event(db, eid)
        return (_row_workset_id(row),) if row else ()
    if src == "analysis":
        row = await db.fetch_one(
            "SELECT at.workset_id AS workset_id FROM analysis_events ae "
            "JOIN analysis_tasks at ON at.id = ae.task_id WHERE ae.id = ?",
            (eid,),
        )
        return (_row_workset_id(row),) if row else ()
    if src == "item_remind":
        from server.calendar.item_projection import parse_occurrence_id
        from server.queries.items_queries import fetch_item_row

        parsed = parse_occurrence_id(eid)
        if parsed is None:
            return ()
        item = await fetch_item_row(db, parsed[0])
        return (_row_workset_id(item),) if item else ()
    return ()

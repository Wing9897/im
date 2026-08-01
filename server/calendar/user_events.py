"""Shared CRUD for user-authored timed events (manual UI + assistant tools).

Field normalization / FK-resolution helpers live in ``user_events_normalize``
and are re-exported below so existing ``from server.calendar.user_events import ...``
call sites keep working unchanged.
"""

from __future__ import annotations

from typing import Any

from server.calendar.timeline_dismissals import attach_dismissed_flag, dismiss_timeline_event
from server.calendar.user_events_normalize import (
    _UNSET,
    ALLOWED_ORIGINS,
    USER_EVENT_TASK_MODES,
    UserEventTaskIdError,
    UserEventValidationError,
    UserEventWorksetIdError,
    _normalize_optional_end,
    _normalize_origin,
    _require_nonempty_title,
    _require_start_time,
    build_user_event_list_filters,
    normalize_user_event_task_id_wire,
    normalize_user_event_workset_id_wire,
    resolve_user_event_task_id,
    resolve_user_event_workset_id,
)
from server.db.database import Database
from server.util import new_id, utc_now_iso
from server.wire.serializers import serialize_user_event
from server.worksets_const import SYSTEM_WORKSET_ID

__all__ = [
    "ALLOWED_ORIGINS",
    "USER_EVENT_TASK_MODES",
    "UserEventValidationError",
    "UserEventTaskIdError",
    "UserEventWorksetIdError",
    "normalize_user_event_task_id_wire",
    "normalize_user_event_workset_id_wire",
    "resolve_user_event_task_id",
    "resolve_user_event_workset_id",
    "build_user_event_list_filters",
    "get_user_event_row",
    "get_user_event",
    "list_user_events",
    "create_user_event",
    "update_user_event",
    "delete_user_event",
]


async def get_user_event_row(db: Database, event_id: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM user_events WHERE id = ?", (event_id,))


async def _serialize_user_event_rows(
    db: Database,
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Apply the one canonical row → wire → dismissal path."""
    items = [serialize_user_event(row) for row in rows]
    return await attach_dismissed_flag(db, source="user", items=items)


async def get_user_event(db: Database, event_id: str) -> dict[str, Any] | None:
    row = await get_user_event_row(db, event_id)
    if row is None:
        return None
    return (await _serialize_user_event_rows(db, [row]))[0]


async def list_user_events(
    db: Database,
    *,
    start: str | None = None,
    end: str | None = None,
    task_id: str | None = None,
    workset_id: str | None = None,
) -> list[dict[str, Any]]:
    """List events that overlap the optional inclusive time window.

    ``task_id`` filter:
    - omitted / ``None``: no provenance filter
    - ``""``: only rows with ``task_id IS NULL``
    - ``__user__``: rejected (``UserEventTaskIdError``) — use ``workset_id``
    - real id: only events tagged with that task provenance

    ``workset_id`` filter:
    - omitted / ``None``: no workset filter
    - real id (incl. ``__user__``): events with that ``workset_id``
    """
    clauses, params = build_user_event_list_filters(
        start=start,
        end=end,
        task_id=task_id,
        workset_id=workset_id,
    )
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = await db.fetch_all(
        f"SELECT * FROM user_events {where} ORDER BY start_time ASC, id ASC",
        tuple(params),
    )
    return await _serialize_user_event_rows(db, rows)


async def create_user_event(
    db: Database,
    *,
    title: str,
    start_time: str,
    end_time: str | None = None,
    body: str = "",
    location: str = "",
    origin: str = "manual",
    task_id: Any = None,
    workset_id: Any = _UNSET,
) -> dict[str, Any]:
    clean_title = _require_nonempty_title(title)
    clean_start = _require_start_time(start_time)
    clean_end = _normalize_optional_end(end_time, clean_start)
    clean_origin = _normalize_origin(origin)
    clean_task_id = await resolve_user_event_task_id(db, task_id)

    if workset_id is _UNSET:
        # Empty / omitted taskId → system workset; real task → copy task workset if any.
        if clean_task_id is None:
            clean_workset_id = SYSTEM_WORKSET_ID
        else:
            task_row = await db.fetch_one(
                "SELECT workset_id FROM analysis_tasks WHERE id = ?",
                (clean_task_id,),
            )
            raw_ws = task_row.get("workset_id") if task_row else None
            if isinstance(raw_ws, str) and raw_ws.strip():
                clean_workset_id = await resolve_user_event_workset_id(db, raw_ws.strip())
            else:
                clean_workset_id = SYSTEM_WORKSET_ID
    else:
        clean_workset_id = await resolve_user_event_workset_id(db, workset_id)

    event_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO user_events "
        "(id, title, body, start_time, end_time, location, origin, task_id, workset_id, "
        "created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            clean_title,
            (body or "").strip(),
            clean_start,
            clean_end,
            (location or "").strip(),
            clean_origin,
            clean_task_id,
            clean_workset_id,
            now,
            now,
        ),
    )
    item = await get_user_event(db, event_id)
    assert item is not None
    return item


async def update_user_event(
    db: Database,
    event_id: str,
    *,
    title: Any = _UNSET,
    start_time: Any = _UNSET,
    end_time: Any = _UNSET,
    body: Any = _UNSET,
    location: Any = _UNSET,
    task_id: Any = _UNSET,
    workset_id: Any = _UNSET,
) -> dict[str, Any] | None:
    """Partial update. Pass ``end_time=None`` (or ``\"\"``) to clear the end."""
    existing = await get_user_event_row(db, event_id)
    if existing is None:
        return None

    next_title = _require_nonempty_title(str(title)) if title is not _UNSET else str(existing["title"])
    next_start = _require_start_time(str(start_time)) if start_time is not _UNSET else str(existing["start_time"])
    if end_time is _UNSET:
        raw_end = existing.get("end_time")
        next_end = str(raw_end).strip() if isinstance(raw_end, str) and raw_end.strip() else None
    else:
        next_end = _normalize_optional_end(
            None if end_time is None else str(end_time),
            next_start,
        )
    if next_end is not None:
        next_end = _normalize_optional_end(next_end, next_start)

    next_body = str(existing.get("body") or "") if body is _UNSET else str(body or "").strip()
    next_location = str(existing.get("location") or "") if location is _UNSET else str(location or "").strip()
    if task_id is _UNSET:
        raw_tid = existing.get("task_id")
        next_task_id = str(raw_tid).strip() if isinstance(raw_tid, str) and raw_tid.strip() else None
    else:
        next_task_id = await resolve_user_event_task_id(db, task_id)

    if workset_id is _UNSET:
        raw_wid = existing.get("workset_id")
        next_workset_id = str(raw_wid).strip() if isinstance(raw_wid, str) and raw_wid.strip() else SYSTEM_WORKSET_ID
        # Ensure FK still resolves (deleted workset → system).
        try:
            next_workset_id = await resolve_user_event_workset_id(db, next_workset_id)
        except UserEventWorksetIdError:
            next_workset_id = SYSTEM_WORKSET_ID
    else:
        next_workset_id = await resolve_user_event_workset_id(db, workset_id)

    await db.execute(
        "UPDATE user_events SET title = ?, body = ?, start_time = ?, end_time = ?, "
        "location = ?, task_id = ?, workset_id = ?, updated_at = ? WHERE id = ?",
        (
            next_title,
            next_body,
            next_start,
            next_end,
            next_location,
            next_task_id,
            next_workset_id,
            utc_now_iso(),
            event_id,
        ),
    )
    item = await get_user_event(db, event_id)
    assert item is not None
    return item


async def delete_user_event(db: Database, event_id: str) -> bool:
    """Soft-dismiss a user event for the timeline (row retained for restore)."""
    existing = await get_user_event_row(db, event_id)
    if existing is None:
        return False
    await dismiss_timeline_event(db, source="user", event_id=event_id)
    return True

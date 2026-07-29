"""Shared CRUD for user-authored timed events (manual UI + assistant tools)."""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.domain.analysis_modes import TIMELINE_OWNING_ANALYSIS_MODES
from server.time_iso import parse_iso, to_iso_z
from server.timeline_dismissals import attach_dismissed_flag, dismiss_timeline_event
from server.util import new_id, utc_now_iso
from server.wire.serializers import serialize_user_event

ALLOWED_ORIGINS = frozenset({"manual", "assistant", "a2a", "project"})
#: Tasks that may own a user_event (filter / timeline attribution).
USER_EVENT_TASK_MODES = TIMELINE_OWNING_ANALYSIS_MODES
#: Wire sentinel for "用戶或助手" (stored as NULL task_id).
USER_EVENT_UNASSIGNED_TASK_ID = "__user__"

# Sentinel: field not provided in a partial update.
_UNSET = object()


class UserEventValidationError(ValueError):
    """Invalid user-event fields."""


class UserEventTaskIdError(UserEventValidationError):
    """Invalid or disallowed ``taskId`` (HTTP 400 at the route boundary)."""


def _require_nonempty_title(title: str) -> str:
    cleaned = (title or "").strip()
    if not cleaned:
        raise UserEventValidationError("title is required")
    return cleaned


def _require_start_time(start_time: str) -> str:
    raw = (start_time or "").strip()
    if not raw:
        raise UserEventValidationError("startTime is required")
    parsed = parse_iso(raw)
    if parsed is None:
        raise UserEventValidationError("startTime must be a valid ISO-8601 datetime")
    # Store canonical UTC Z so list windows and UI calendars compare reliably.
    return to_iso_z(parsed)


def _normalize_optional_end(end_time: str | None, start_time: str) -> str | None:
    if end_time is None:
        return None
    raw = str(end_time).strip()
    if not raw:
        return None
    parsed_end = parse_iso(raw)
    if parsed_end is None:
        raise UserEventValidationError("endTime must be a valid ISO-8601 datetime")
    parsed_start = parse_iso(start_time)
    if parsed_start is not None and parsed_end < parsed_start:
        raise UserEventValidationError("endTime must be >= startTime")
    return to_iso_z(parsed_end)


def _normalize_origin(origin: str) -> str:
    value = (origin or "").strip()
    if value not in ALLOWED_ORIGINS:
        raise UserEventValidationError("origin must be 'manual', 'assistant', 'a2a', or 'project'")
    return value


def normalize_user_event_task_id_wire(task_id: Any) -> str | None | object:
    """Map wire ``taskId`` to DB value or ``_UNSET`` when omitted.

    ``None`` / ``""`` / ``__user__`` → store NULL. Other strings → validate later.
    """
    if task_id is _UNSET:
        return _UNSET
    if task_id is None:
        return None
    cleaned = str(task_id).strip()
    if not cleaned or cleaned == USER_EVENT_UNASSIGNED_TASK_ID:
        return None
    return cleaned


async def resolve_user_event_task_id(db: Database, task_id: Any) -> str | None:
    """Resolve wire taskId to a stored FK value (NULL = 用戶或助手)."""
    normalized = normalize_user_event_task_id_wire(task_id)
    if normalized is None:
        return None
    assert isinstance(normalized, str)
    row = await db.fetch_one(
        "SELECT id, analysis_mode FROM analysis_tasks WHERE id = ?",
        (normalized,),
    )
    if row is None:
        raise UserEventTaskIdError("taskId does not refer to an existing task")
    mode = str(row.get("analysis_mode") or "")
    if mode not in USER_EVENT_TASK_MODES:
        raise UserEventTaskIdError("taskId must refer to an event, recurring, calendar_task, or project task")
    return normalized


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
) -> list[dict[str, Any]]:
    """List events that overlap the optional inclusive time window.

    ``task_id`` filter:
    - omitted / ``None``: all user events
    - ``""`` / ``__user__``: only unassigned (``task_id IS NULL``)
    - real id: only events tagged with that task
    """
    clauses: list[str] = []
    params: list[Any] = []
    if start and start.strip():
        clauses.append("julianday(COALESCE(NULLIF(end_time, ''), start_time)) >= julianday(?)")
        params.append(start.strip())
    if end and end.strip():
        clauses.append("julianday(start_time) <= julianday(?)")
        params.append(end.strip())
    if task_id is not None:
        tid = str(task_id).strip()
        if not tid or tid == USER_EVENT_UNASSIGNED_TASK_ID:
            clauses.append("task_id IS NULL")
        else:
            clauses.append("task_id = ?")
            params.append(tid)
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
) -> dict[str, Any]:
    clean_title = _require_nonempty_title(title)
    clean_start = _require_start_time(start_time)
    clean_end = _normalize_optional_end(end_time, clean_start)
    clean_origin = _normalize_origin(origin)
    clean_task_id = await resolve_user_event_task_id(db, task_id)
    event_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO user_events "
        "(id, title, body, start_time, end_time, location, origin, task_id, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            clean_title,
            (body or "").strip(),
            clean_start,
            clean_end,
            (location or "").strip(),
            clean_origin,
            clean_task_id,
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

    await db.execute(
        "UPDATE user_events SET title = ?, body = ?, start_time = ?, end_time = ?, "
        "location = ?, task_id = ?, updated_at = ? WHERE id = ?",
        (
            next_title,
            next_body,
            next_start,
            next_end,
            next_location,
            next_task_id,
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

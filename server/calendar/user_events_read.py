"""Read side of user-authored timed events (manual UI + assistant tools).

Writes live in ``user_events_write``; field normalization / FK-resolution in
``user_events_normalize``. The raw single-row query is
``server.queries.calendar_queries.fetch_user_event`` (one entry point only).
"""

from __future__ import annotations

from typing import Any

from server.calendar.timeline_dismissals import attach_dismissed_flag
from server.calendar.timeline_importance import attach_important_flag
from server.calendar.user_events_normalize import build_user_event_list_filters
from server.db.database import Database
from server.queries.calendar_queries import fetch_user_event
from server.wire.serializers import serialize_user_event

__all__ = [
    "get_user_event",
    "list_user_events",
    "list_user_events_page",
]


async def _serialize_user_event_rows(
    db: Database,
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Apply the one canonical row → wire → dismissal path."""
    items = [serialize_user_event(row) for row in rows]
    await attach_dismissed_flag(db, source="user", items=items)
    return await attach_important_flag(db, source="user", items=items)


async def get_user_event(db: Database, event_id: str) -> dict[str, Any] | None:
    row = await fetch_user_event(db, event_id)
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
    item_id: str | None = None,
    search: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """List events that overlap the optional inclusive time window.

    ``task_id`` filter:
    - omitted / ``None``: no provenance filter
    - ``""``: only rows with ``task_id IS NULL``
    - ``__general__``: rejected (``UserEventTaskIdError``) — use ``workset_id``
    - real id: only events tagged with that task provenance

    ``workset_id`` filter:
    - omitted / ``None``: no workset filter
    - real id (incl. ``__general__``): events with that ``workset_id``

    ``item_id`` filter:
    - omitted / ``None``: no parent-item filter
    - ``""``: only stand-alone rows (``item_id IS NULL``)
    - real id: linked calendars under that item

    ``search``: optional substring on title / body / location.

    When ``limit`` is set, apply OFFSET/LIMIT paging (same clamp as other list
    routes). When omitted, return the full matching set (timeline callers).
    """
    page = await list_user_events_page(
        db,
        start=start,
        end=end,
        task_id=task_id,
        workset_id=workset_id,
        item_id=item_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return page["items"]


async def list_user_events_page(
    db: Database,
    *,
    start: str | None = None,
    end: str | None = None,
    task_id: str | None = None,
    workset_id: str | None = None,
    item_id: str | None = None,
    search: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> dict[str, Any]:
    """Return ``{items, totalCount, hasMore}`` for the user-events list."""
    from server.queries.pagination import clamp_offset_limit, offset_page_has_more

    clauses, params = build_user_event_list_filters(
        start=start,
        end=end,
        task_id=task_id,
        workset_id=workset_id,
        item_id=item_id,
        search=search,
    )
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    total_count = int(await db.fetch_value(f"SELECT COUNT(*) FROM user_events {where}", tuple(params)) or 0)
    order_sql = f"SELECT * FROM user_events {where} ORDER BY start_time ASC, id ASC"
    if limit is None:
        rows = await db.fetch_all(order_sql, tuple(params))
        items = await _serialize_user_event_rows(db, rows)
        return {"items": items, "totalCount": total_count, "hasMore": False}

    normalized_limit, normalized_offset = clamp_offset_limit(limit, offset)
    rows = await db.fetch_all(
        f"{order_sql} LIMIT ? OFFSET ?",
        tuple(list(params) + [normalized_limit, normalized_offset]),
    )
    items = await _serialize_user_event_rows(db, rows)
    return {
        "items": items,
        "totalCount": total_count,
        "hasMore": offset_page_has_more(normalized_offset, len(rows), total_count),
    }

"""Unified calendar query layer for Agent tools (and shared RRULE helpers).

Merges ``analysis_events``, RRULE expansions, and ``user_events`` into one
sorted item list. Normalize helpers live in ``server.calendar.normalize``.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from server.calendar.item_projection import fetch_item_occurrences_in_range, get_item_occurrence
from server.calendar.normalize import (
    OCCURRENCE_ID_RE,
    Source,
    build_analysis_item,
    build_item_calendar_item,
    build_occurrence_item,
    build_user_item,
    clamp_limit,
    matches_search,
    parse_cursor,
)
from server.calendar.rrule import expand_calendar_occurrences
from server.calendar.timeline_dismissals import attach_dismissed_flag, is_timeline_event_dismissed
from server.calendar.user_events import list_user_events
from server.db.database import Database
from server.domain.analysis_modes import TIMELINE_OWNING_ANALYSIS_MODES
from server.queries.calendar_queries import (
    fetch_active_recurring_task_rows,
    fetch_analysis_event_detail,
    fetch_calendar_rows,
    fetch_user_event,
)
from server.queries.results_queries import query_analysis_events
from server.time_iso import parse_iso, to_iso_z
from server.wire.serializers import serialize_user_event
from server.worksets_const import SYSTEM_WORKSET_ID

# Look-ahead / look-back cap for upcoming/recent (also calendar.upcoming days max).
HORIZON_DAYS = 365
_FETCH_CAP = 500

__all__ = [
    "HORIZON_DAYS",
    "Source",
    "expand_active_calendar_occurrences",
    "fetch_active_recurring_tasks",
    "get_event",
    "list_calendars",
    "query_recent",
    "query_upcoming",
    "query_window",
]


def _is_system_workset_only_filter(workset_id: str | None) -> bool:
    """True when the caller asked only for system-workset user events (no analysis/RRULE)."""
    if workset_id is None:
        return False
    return str(workset_id).strip() == SYSTEM_WORKSET_ID


async def _fetch_user_in_range(
    db: Database,
    *,
    range_start: datetime,
    range_end: datetime,
    task_id: str | None,
    workset_id: str | None = None,
) -> list[dict[str, Any]]:
    """User events for the window; optional task / workset filters.

    - no ``task_id`` / ``workset_id``: all user events in range
    - ``workset_id`` set: events with that ownership workset
    - ``task_id`` empty: only rows with ``task_id IS NULL``
    - real ``task_id``: only events tagged with that task provenance
    - ``task_id=__user__``: rejected by ``list_user_events``
    """
    items = await list_user_events(
        db,
        start=to_iso_z(range_start),
        end=to_iso_z(range_end),
        task_id=task_id,
        workset_id=workset_id,
    )
    return [build_user_item(item) for item in items]


async def list_calendars(db: Database) -> list[dict[str, Any]]:
    """Return metadata for tasks that can produce calendar items (no event bodies)."""
    modes = tuple(sorted(TIMELINE_OWNING_ANALYSIS_MODES))
    rows = await fetch_calendar_rows(db, modes)
    return [
        {
            "id": str(row["id"]),
            "name": str(row.get("name") or ""),
            "analysisMode": str(row.get("analysis_mode") or ""),
            "isActive": bool(row.get("is_active")),
            "rrule": row.get("rrule"),
            "location": row.get("event_location"),
            "description": row.get("event_description"),
            "isAllDay": bool(row.get("event_is_all_day")),
            "eventStartTime": row.get("event_start_time"),
            "eventEndTime": row.get("event_end_time"),
            "timezone": row.get("event_timezone"),
        }
        for row in rows
    ]


async def fetch_active_recurring_tasks(
    db: Database,
    *,
    task_id: str | None = None,
    task_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Active ``recurring``-mode tasks (shared by Agent + ``GET /api/v1/calendar/items``).

    When ``task_ids`` is set, include those recurring rows **or** active children
    whose ``parent_task_id`` is in the list.
    When ``task_id`` is set (and ``task_ids`` is not), include that recurring row
    **or** any active child recurring tasks whose ``parent_task_id`` matches
    (project scope).
    """
    return await fetch_active_recurring_task_rows(db, task_id=task_id, task_ids=task_ids)


async def expand_active_calendar_occurrences(
    db: Database,
    range_start: datetime,
    range_end: datetime,
    *,
    task_id: str | None = None,
    task_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """RRULE occurrences in camelCase CalendarOccurrence shape (Calendar items API)."""
    tasks = await fetch_active_recurring_tasks(db, task_id=task_id, task_ids=task_ids)
    return expand_calendar_occurrences(tasks, range_start, range_end)


async def _fetch_analysis_in_range(
    db: Database,
    *,
    range_start: datetime,
    range_end: datetime,
    task_id: str | None,
    search: str | None,
    fetch_limit: int,
    ascending: bool = True,
) -> list[dict[str, Any]]:
    rows, _ = await query_analysis_events(
        db,
        task_id=task_id,
        search=search.strip() if search and search.strip() else None,
        start_date=to_iso_z(range_start),
        end_date=to_iso_z(range_end),
        sort="event_time",
        limit=fetch_limit,
        offset=0,
        has_time=None,
        has_coords=None,
        search_location=True,
        ascending=ascending,
        include_total=False,
        require_include_in_timeline=True,
    )
    return [build_analysis_item(row) for row in rows]


async def _fetch_rrule_in_range(
    db: Database,
    *,
    range_start: datetime,
    range_end: datetime,
    task_id: str | None,
) -> list[dict[str, Any]]:
    occurrences = await expand_active_calendar_occurrences(db, range_start, range_end, task_id=task_id)
    items = [build_occurrence_item(occ) for occ in occurrences]
    # DB dismissal source is "recurring" for RRULE occurrence ids.
    await attach_dismissed_flag(db, source="recurring", items=items)
    return items


async def _annotate_analysis_dismissed(
    db: Database,
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    await attach_dismissed_flag(db, source="analysis", items=items)
    return items


async def _fetch_items_in_range(
    db: Database,
    *,
    range_start: datetime,
    range_end: datetime,
    workset_id: str | None = None,
) -> list[dict[str, Any]]:
    """Active item DATE projections (purchased/expires); archived excluded."""
    raw = await fetch_item_occurrences_in_range(
        db,
        range_start=range_start,
        range_end=range_end,
        workset_id=workset_id,
    )
    items = [build_item_calendar_item(item) for item in raw]
    await attach_dismissed_flag(db, source="item", items=items)
    return items


def _merge_sort_slice(
    items: list[dict[str, Any]],
    *,
    search: str | None,
    limit: int,
    offset: int,
    ascending: bool,
) -> tuple[list[dict[str, Any]], str | None]:
    filtered = [item for item in items if matches_search(item, search)]
    filtered.sort(
        key=lambda item: (item.get("startTime") or "", item.get("id") or ""),
        reverse=not ascending,
    )
    page = filtered[offset : offset + limit]
    next_offset = offset + len(page)
    next_cursor = str(next_offset) if next_offset < len(filtered) else None
    return page, next_cursor


async def query_window(
    db: Database,
    *,
    start: str | datetime,
    end: str | datetime,
    limit: int = 50,
    cursor: str | None = None,
    search: str | None = None,
    task_id: str | None = None,
    workset_id: str | None = None,
    hard_cap: int = 100,
) -> dict[str, Any]:
    """Events whose sort-time falls in ``[start, end]`` (inclusive), merged sources."""
    range_start = start if isinstance(start, datetime) else parse_iso(start)
    range_end = end if isinstance(end, datetime) else parse_iso(end, end_of_day=True)
    if range_start is None or range_end is None:
        raise ValueError("start and end must be valid ISO-8601 datetimes")
    if range_end < range_start:
        raise ValueError("end must be >= start")

    capped = clamp_limit(limit, default=50, hard_cap=hard_cap)
    offset = parse_cursor(cursor)
    # System-workset-only filter never matches analysis/RRULE.
    if _is_system_workset_only_filter(workset_id):
        analysis: list[dict[str, Any]] = []
        rrule_items: list[dict[str, Any]] = []
    else:
        analysis = await _fetch_analysis_in_range(
            db,
            range_start=range_start,
            range_end=range_end,
            task_id=task_id,
            search=search,
            fetch_limit=_FETCH_CAP,
        )
        await _annotate_analysis_dismissed(db, analysis)
        rrule_items = await _fetch_rrule_in_range(
            db,
            range_start=range_start,
            range_end=range_end,
            task_id=task_id,
        )
    user_items = await _fetch_user_in_range(
        db,
        range_start=range_start,
        range_end=range_end,
        task_id=task_id,
        workset_id=workset_id,
    )
    # Items are ownership-scoped by workset only (no task provenance).
    # When filtering by task_id alone with no workset, skip item projections.
    if task_id is not None and workset_id is None:
        item_items: list[dict[str, Any]] = []
    else:
        item_items = await _fetch_items_in_range(
            db,
            range_start=range_start,
            range_end=range_end,
            workset_id=workset_id,
        )
    items, next_cursor = _merge_sort_slice(
        analysis + rrule_items + user_items + item_items,
        search=search,
        limit=capped,
        offset=offset,
        ascending=True,
    )
    return {
        "items": items,
        "limit": capped,
        "cursor": cursor,
        "nextCursor": next_cursor,
    }


async def query_upcoming(
    db: Database,
    *,
    limit: int = 20,
    days: int | None = None,
    search: str | None = None,
    task_id: str | None = None,
    workset_id: str | None = None,
    now: datetime | None = None,
    hard_cap: int = 100,
) -> dict[str, Any]:
    """Future events from ``now``. Prefer ``days`` for relative「未來 N 天」queries."""
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    capped = clamp_limit(limit, default=20, hard_cap=hard_cap)
    if days is None:
        horizon = timedelta(days=HORIZON_DAYS)
        days_used = HORIZON_DAYS
    else:
        days_used = min(max(int(days), 1), HORIZON_DAYS)
        horizon = timedelta(days=days_used, hours=23, minutes=59, seconds=59)
    result = await query_window(
        db,
        start=moment,
        end=moment + horizon,
        limit=capped,
        cursor=None,
        search=search,
        task_id=task_id,
        workset_id=workset_id,
        hard_cap=hard_cap,
    )
    return {"items": result["items"], "limit": capped, "days": days_used}


async def query_recent(
    db: Database,
    *,
    limit: int = 20,
    search: str | None = None,
    task_id: str | None = None,
    workset_id: str | None = None,
    now: datetime | None = None,
    hard_cap: int = 100,
) -> dict[str, Any]:
    """Past events in the one-year look-back window, newest first."""
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    capped = clamp_limit(limit, default=20, hard_cap=hard_cap)
    range_start = moment - timedelta(days=HORIZON_DAYS)
    range_end = moment - timedelta(seconds=1)
    if _is_system_workset_only_filter(workset_id):
        analysis: list[dict[str, Any]] = []
        rrule_items: list[dict[str, Any]] = []
    else:
        analysis = await _fetch_analysis_in_range(
            db,
            range_start=range_start,
            range_end=range_end,
            task_id=task_id,
            search=search,
            fetch_limit=_FETCH_CAP,
            ascending=False,
        )
        await _annotate_analysis_dismissed(db, analysis)
        rrule_items = await _fetch_rrule_in_range(
            db,
            range_start=range_start,
            range_end=range_end,
            task_id=task_id,
        )
    user_items = await _fetch_user_in_range(
        db,
        range_start=range_start,
        range_end=range_end,
        task_id=task_id,
        workset_id=workset_id,
    )
    if task_id is not None and workset_id is None:
        item_items: list[dict[str, Any]] = []
    else:
        item_items = await _fetch_items_in_range(
            db,
            range_start=range_start,
            range_end=range_end,
            workset_id=workset_id,
        )
    items, _ = _merge_sort_slice(
        analysis + rrule_items + user_items + item_items,
        search=search,
        limit=capped,
        offset=0,
        ascending=False,
    )
    return {"items": items, "limit": capped}


async def get_event(db: Database, *, event_id: str) -> dict[str, Any] | None:
    """Fetch one event by analysis id, user-event id, item, or RRULE occurrence id."""
    eid = (event_id or "").strip()
    if not eid:
        return None

    row = await fetch_analysis_event_detail(db, eid)
    if row is not None:
        return build_analysis_item(
            row,
            detail="full",
            dismissed=await is_timeline_event_dismissed(db, source="analysis", event_id=eid),
        )

    user_row = await fetch_user_event(db, eid)
    if user_row is not None:
        dismissed = await is_timeline_event_dismissed(db, source="user", event_id=eid)
        return build_user_item(serialize_user_event(user_row, dismissed=dismissed), detail="full")

    item_occ = await get_item_occurrence(db, eid)
    if item_occ is not None:
        dismissed = await is_timeline_event_dismissed(db, source="item", event_id=eid)
        item_occ["dismissed"] = dismissed
        return build_item_calendar_item(item_occ, detail="full")

    match = OCCURRENCE_ID_RE.match(eid)
    if match is None:
        return None
    task_id, stamp = match.group(1), match.group(2)
    occurrence_start = parse_iso(f"{stamp[0:4]}-{stamp[4:6]}-{stamp[6:8]}T{stamp[9:11]}:{stamp[11:13]}:{stamp[13:15]}Z")
    if occurrence_start is None:
        return None
    window_start = occurrence_start - timedelta(seconds=1)
    window_end = occurrence_start + timedelta(seconds=1)
    for occ in await expand_active_calendar_occurrences(db, window_start, window_end, task_id=task_id):
        if occ.get("id") == eid:
            return build_occurrence_item(
                occ,
                detail="full",
                dismissed=await is_timeline_event_dismissed(db, source="recurring", event_id=eid),
            )
    return None

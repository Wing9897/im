"""Unified calendar query layer for Agent tools (and shared RRULE helpers).

Merges ``analysis_events``, RRULE expansions, and ``user_events`` into one
sorted item list. Normalize helpers live in ``server.calendar.normalize``.
Fetch helpers live in ``server.calendar.query_fetch``.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from server.calendar.item_projection import get_item_occurrence
from server.calendar.normalize import (
    OCCURRENCE_ID_RE,
    Source,
    build_analysis_item,
    build_item_calendar_item,
    build_occurrence_item,
    build_user_item,
    clamp_limit,
    parse_cursor,
)
from server.calendar.query_fetch import (
    _FETCH_CAP,
    _annotate_analysis_dismissed,
    _fetch_analysis_in_range,
    _fetch_items_in_range,
    _fetch_rrule_in_range,
    _fetch_user_in_range,
    expand_active_calendar_occurrences,
    fetch_active_recurring_tasks,
    list_calendars,
)
from server.calendar.query_merge import merge_calendar_items, source_policy
from server.calendar.timeline_dismissals import is_timeline_event_dismissed
from server.db.database import Database
from server.queries.calendar_queries import (
    fetch_analysis_event_detail,
    fetch_user_event,
)
from server.time_iso import parse_iso
from server.wire.serializers import serialize_user_event

# Look-ahead / look-back cap for upcoming/recent (also calendar.upcoming days max).
HORIZON_DAYS = 365

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
    policy = source_policy(task_id=task_id, workset_id=workset_id)
    if not policy.include_analysis_and_recurrence:
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
    if not policy.include_items:
        item_items: list[dict[str, Any]] = []
    else:
        item_items = await _fetch_items_in_range(
            db,
            range_start=range_start,
            range_end=range_end,
            workset_id=workset_id,
        )
    items, next_cursor = merge_calendar_items(
        (analysis, rrule_items, user_items, item_items),
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
    policy = source_policy(task_id=task_id, workset_id=workset_id)
    if not policy.include_analysis_and_recurrence:
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
    if not policy.include_items:
        item_items: list[dict[str, Any]] = []
    else:
        item_items = await _fetch_items_in_range(
            db,
            range_start=range_start,
            range_end=range_end,
            workset_id=workset_id,
        )
    items, _ = merge_calendar_items(
        (analysis, rrule_items, user_items, item_items),
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

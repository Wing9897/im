"""Calendar query source fetchers (analysis / RRULE / user / item)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from server.calendar.item_projection import fetch_item_occurrences_in_range
from server.calendar.normalize import (
    build_analysis_item,
    build_item_calendar_item,
    build_occurrence_item,
    build_user_item,
)
from server.calendar.rrule import expand_calendar_occurrences
from server.calendar.timeline_dismissals import attach_dismissed_flag
from server.calendar.user_events import list_user_events
from server.db.database import Database
from server.domain.analysis_modes import TIMELINE_OWNING_ANALYSIS_MODES
from server.queries.calendar_queries import (
    fetch_active_recurring_task_rows,
    fetch_calendar_rows,
)
from server.queries.results_queries import query_analysis_events
from server.time_iso import to_iso_z

_FETCH_CAP = 500


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
    """Calendar-purpose RRULE occurrences (never AI trigger ``schedule_rrule``)."""
    from server.domain.schedule import may_calendar_expand

    tasks = await fetch_active_recurring_tasks(db, task_id=task_id, task_ids=task_ids)
    # Defense in depth: SQL already filters analysis_mode=recurring; re-gate by purpose.
    tasks = [task for task in tasks if may_calendar_expand(str(task.get("analysis_mode") or ""))]
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

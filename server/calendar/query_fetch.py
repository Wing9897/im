"""Calendar query source fetchers (analysis / RRULE / user / item_remind)."""

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
from server.calendar.timeline_importance import attach_important_flag
from server.calendar.user_events import list_user_events
from server.db.database import Database
from server.domain.analysis_modes import TIMELINE_OWNING_ANALYSIS_MODES
from server.queries.calendar_queries import (
    fetch_active_recurring_series_rows,
    fetch_calendar_rows,
    fetch_recurring_series_rows,
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


def calendar_list_item_from_task_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": str(row.get("name") or ""),
        "kind": "analysis_task",
        "source": "analysis",
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


def calendar_list_item_from_series_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": str(row.get("name") or ""),
        "kind": "recurring_series",
        "source": "recurring",
        "analysisMode": "",
        "isActive": bool(row.get("is_active")),
        "rrule": row.get("rrule"),
        "location": row.get("event_location"),
        "description": row.get("event_description"),
        "isAllDay": bool(row.get("event_is_all_day")),
        "eventStartTime": row.get("event_start_time"),
        "eventEndTime": row.get("event_end_time"),
        "timezone": row.get("event_timezone"),
    }


async def list_calendars(
    db: Database,
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    """Return metadata for AI timeline-owning tasks + standalone recurring series.

    By default only **active** series are included (paused series are omitted).
    Pass ``include_inactive=True`` to discover paused series for resume-by-name.
    Analysis-task rows already include inactive tasks.
    """
    modes = tuple(sorted(TIMELINE_OWNING_ANALYSIS_MODES))
    rows = await fetch_calendar_rows(db, modes)
    items = [calendar_list_item_from_task_row(row) for row in rows]
    series_rows = await fetch_recurring_series_rows(db, include_inactive=include_inactive)
    items.extend(calendar_list_item_from_series_row(row) for row in series_rows)
    return items


async def fetch_active_recurring_series(
    db: Database,
    *,
    series_id: str | None = None,
    series_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Active recurring series (shared by Agent + ``GET /api/v1/calendar/items``).

    ``series_id`` / ``series_ids`` filter by series id **or** ``parent_task_id``
    (agent project scope).
    """
    return await fetch_active_recurring_series_rows(
        db,
        series_id=series_id,
        series_ids=series_ids,
    )


async def expand_active_calendar_occurrences(
    db: Database,
    range_start: datetime,
    range_end: datetime,
    *,
    series_id: str | None = None,
    series_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Calendar-purpose RRULE occurrences (never AI trigger ``schedule_rrule``)."""
    from server.domain.schedule import may_calendar_expand_series

    series = await fetch_active_recurring_series(
        db, series_id=series_id, series_ids=series_ids
    )
    series = [row for row in series if may_calendar_expand_series(row)]
    return expand_calendar_occurrences(series, range_start, range_end)


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
    occurrences = await expand_active_calendar_occurrences(
        db, range_start, range_end, series_id=task_id
    )
    items = [build_occurrence_item(occ) for occ in occurrences]
    # DB dismissal source is "recurring" for RRULE occurrence ids.
    await attach_dismissed_flag(db, source="recurring", items=items)
    await attach_important_flag(db, source="recurring", items=items)
    return items


async def _annotate_analysis_dismissed(
    db: Database,
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    await attach_dismissed_flag(db, source="analysis", items=items)
    await attach_important_flag(db, source="analysis", items=items)
    return items


async def _fetch_items_in_range(
    db: Database,
    *,
    range_start: datetime,
    range_end: datetime,
    workset_id: str | None = None,
) -> list[dict[str, Any]]:
    """Active item DATE projections (remind-only); archived excluded."""
    raw = await fetch_item_occurrences_in_range(
        db,
        range_start=range_start,
        range_end=range_end,
        workset_id=workset_id,
    )
    items = [build_item_calendar_item(item) for item in raw]
    await attach_dismissed_flag(db, source="item_remind", items=items)
    await attach_important_flag(db, source="item_remind", items=items)
    return items

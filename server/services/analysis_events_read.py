"""Analysis-event list shared by ``GET /results/events`` and the Agent search tool.

Calendar window reads and timeline merge stay in ``server.calendar.query_fetch``.
This module owns list-parameter normalization, the current-version query,
wire serialization, and timeline dismissed / important flags.
"""

from __future__ import annotations

from typing import Any, TypedDict

from server.calendar.timeline_markers import attach_timeline_flags
from server.db.database import Database
from server.queries.pagination import MAX_PAGE_LIMIT, clamp_offset_limit, offset_page_has_more
from server.queries.results_queries import query_analysis_events
from server.util import parse_bool
from server.wire.serializers import serialize_analysis_event

_EVENT_SORTS = frozenset({"event_time", "analyzed_at"})
_FALSE_FLAG_VALUES = frozenset({"0", "false", "no", "off"})

__all__ = [
    "AnalysisEventsPage",
    "AnalysisEventsReadError",
    "list_analysis_events",
]


class AnalysisEventsReadError(ValueError):
    """Rejected analysis-event list parameters.

    Routes translate this to HTTP 422. The Agent tool does not raise it for
    sort (unknown sorts fall back to the tool default).
    """


class AnalysisEventsPage(TypedDict):
    items: list[dict[str, Any]]
    totalCount: int
    hasMore: bool
    sort: str
    limit: int
    offset: int


def _coerce_optional_bool(value: bool | str | None) -> bool | None:
    """Optional flag: bool passthrough, REST query strings, invalid → error.

    Truthiness delegates to ``util.parse_bool``; explicit false sentinels
    mirror its on/off symmetry (0/false/no/off).
    """
    if value is None or isinstance(value, bool):
        return value
    if parse_bool(value):
        return True
    if value.strip().lower() in _FALSE_FLAG_VALUES:
        return False
    raise AnalysisEventsReadError(f"Invalid boolean flag: {value!r}")


def _normalize_sort(sort: str | None, *, default_sort: str, strict: bool) -> str:
    fallback = (default_sort or "event_time").strip().lower()
    if fallback not in _EVENT_SORTS:
        fallback = "event_time"
    sort_key = (sort or fallback).strip().lower()
    if sort_key in _EVENT_SORTS:
        return sort_key
    if not strict:
        return fallback
    allowed = ", ".join(sorted(_EVENT_SORTS))
    raise AnalysisEventsReadError(f"Invalid sort: {sort!r}. Allowed: {allowed}")


async def list_analysis_events(
    db: Database,
    *,
    task_id: str | None = None,
    task_ids: list[str] | None = None,
    search: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort: str | None = None,
    limit: int = 50,
    offset: int = 0,
    has_time: bool | str | None = None,
    has_coords: bool | str | None = None,
    include_total: bool | None = None,
    include_in_timeline: bool | str | None = None,
    search_location: bool = False,
    ascending: bool = False,
    workset_ids: list[str] | None = None,
    max_limit: int = MAX_PAGE_LIMIT,
    default_sort: str = "event_time",
    strict_sort: bool = True,
    include_important: bool = True,
) -> AnalysisEventsPage:
    """Return one serialized analysis-event page with timeline flags.

    ``task_ids`` (when not None) wins over ``task_id`` inside the query.
    ``include_in_timeline`` true restricts to tasks opted into time planning;
    omitted / false does not. ``workset_ids`` None means no workset filter
    (REST). An empty list matches nothing (Agent scope fail-closed).

    ``strict_sort`` rejects unknown sorts (REST 422). When false, unknown
    sorts fall back to ``default_sort`` (Agent: ``analyzed_at``).
    """
    sort_key = _normalize_sort(sort, default_sort=default_sort, strict=strict_sort)
    normalized_limit, normalized_offset = clamp_offset_limit(limit, offset, max_limit=max_limit)
    resolved_include_total = True if include_total is None else bool(include_total)
    rows, total_count = await query_analysis_events(
        db,
        task_id=task_id,
        task_ids=task_ids,
        search=search,
        start_date=start_date,
        end_date=end_date,
        sort=sort_key,
        limit=normalized_limit,
        offset=normalized_offset,
        has_time=_coerce_optional_bool(has_time),
        has_coords=_coerce_optional_bool(has_coords),
        search_location=search_location,
        ascending=ascending,
        include_total=resolved_include_total,
        require_include_in_timeline=_coerce_optional_bool(include_in_timeline) is True,
        workset_ids=workset_ids,
    )
    items = [serialize_analysis_event(row) for row in rows]
    await attach_timeline_flags(db, source="analysis", items=items, include_important=include_important)
    return {
        "items": items,
        "totalCount": total_count if resolved_include_total else 0,
        "hasMore": (
            offset_page_has_more(normalized_offset, len(rows), total_count)
            if resolved_include_total
            else len(rows) >= normalized_limit
        ),
        "sort": sort_key,
        "limit": normalized_limit,
        "offset": normalized_offset,
    }

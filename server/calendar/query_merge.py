"""Pure filtering and merge/pagination policy for calendar queries."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from server.calendar.normalize import matches_search
from server.worksets_const import SYSTEM_WORKSET_ID


@dataclass(frozen=True)
class CalendarSourcePolicy:
    include_analysis_and_recurrence: bool
    include_items: bool


def source_policy(*, task_id: str | None, workset_id: str | None) -> CalendarSourcePolicy:
    """Resolve ownership/provenance filters without performing I/O."""
    system_workset_only = workset_id is not None and str(workset_id).strip() == SYSTEM_WORKSET_ID
    return CalendarSourcePolicy(
        include_analysis_and_recurrence=not system_workset_only,
        include_items=not (task_id is not None and workset_id is None),
    )


def merge_calendar_items(
    sources: Iterable[list[dict[str, Any]]],
    *,
    search: str | None,
    limit: int,
    offset: int,
    ascending: bool,
) -> tuple[list[dict[str, Any]], str | None]:
    """Filter, deterministically sort, and slice already-normalized sources."""
    filtered = [item for source in sources for item in source if matches_search(item, search)]
    filtered.sort(
        key=lambda item: (item.get("startTime") or "", item.get("id") or ""),
        reverse=not ascending,
    )
    page = filtered[offset : offset + limit]
    next_offset = offset + len(page)
    next_cursor = str(next_offset) if next_offset < len(filtered) else None
    return page, next_cursor

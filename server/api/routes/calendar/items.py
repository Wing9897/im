"""Unified calendar occurrence expansion (shared by Timeline / Board / Gantt)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Request

from server.api.deps import get_db
from server.api.schemas.responses import CalendarOccurrenceResponse
from server.calendar.query import expand_active_calendar_occurrences
from server.calendar.timeline_dismissals import attach_dismissed_flag
from server.errors import VALIDATION_ERROR, http_error
from server.time_iso import parse_iso

router = APIRouter(tags=["calendar"])


def _parse_range_param(value: str, name: str, *, end_of_day: bool = False):
    parsed = parse_iso(value, end_of_day=end_of_day)
    if parsed is None:
        raise http_error(422, f"Invalid {name}: {value}", error_code=VALIDATION_ERROR)
    return parsed


@router.get("/items", response_model=list[CalendarOccurrenceResponse])
async def list_calendar_items(
    request: Request,
    range_start: str,
    range_end: str,
    task_id: Optional[str] = Query(default=None),
    task_ids: Optional[list[str]] = Query(default=None),
) -> list[dict]:
    start = _parse_range_param(range_start, "range_start")
    end = _parse_range_param(range_end, "range_end", end_of_day=True)
    effective_ids = task_ids if task_ids is not None else None
    items = await expand_active_calendar_occurrences(
        get_db(request),
        start,
        end,
        task_id=None if effective_ids is not None else task_id,
        task_ids=effective_ids,
    )
    await attach_dismissed_flag(get_db(request), source="recurring", items=items)
    return items

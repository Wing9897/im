"""Unified calendar occurrence expansion (shared by Timeline / Board / Gantt).

Returns RRULE expansions plus optional trackable-item DATE projections
(``source=item``) from the same ``item_projection`` path used by agent
``query_window`` — one server projection, no FE dual-track.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Query, Request

from server.api.deps import get_db
from server.api.schemas.responses import CalendarOccurrenceResponse
from server.calendar.item_projection import fetch_item_occurrences_in_range
from server.calendar.normalize import build_item_calendar_item
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


def _as_api_recurring_row(occ: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": occ["id"],
        "taskId": occ.get("taskId") or "",
        "taskName": occ.get("taskName") or "",
        "title": occ.get("title") or "",
        "startTime": occ["startTime"],
        "endTime": occ.get("endTime") or occ["startTime"],
        "isAllDay": bool(occ.get("isAllDay")),
        "timezone": occ.get("timezone"),
        "location": occ.get("location"),
        "description": occ.get("description"),
        "rrule": occ.get("rrule") or "",
        "dismissed": bool(occ.get("dismissed")),
        "source": "recurring",
        "worksetId": None,
        "itemId": None,
        "itemDateKind": None,
    }


def _as_api_item_row(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "taskId": item.get("taskId") or "",
        "taskName": "",
        "title": item.get("title") or "",
        "startTime": item["startTime"],
        "endTime": item.get("endTime") or item["startTime"],
        "isAllDay": True,
        "timezone": item.get("timezone") or "floating",
        "location": item.get("location"),
        "description": None,
        "rrule": "",
        "dismissed": bool(item.get("dismissed")),
        "source": "item",
        "worksetId": item.get("worksetId"),
        "itemId": item.get("itemId"),
        "itemDateKind": item.get("itemDateKind"),
    }


@router.get("/items", response_model=list[CalendarOccurrenceResponse])
async def list_calendar_items(
    request: Request,
    range_start: str,
    range_end: str,
    task_id: Optional[str] = Query(default=None),
    task_ids: Optional[list[str]] = Query(default=None),
    include_items: bool = Query(
        default=True,
        description="Include trackable-item purchased/expires DATE projections (source=item).",
    ),
) -> list[dict]:
    start = _parse_range_param(range_start, "range_start")
    end = _parse_range_param(range_end, "range_end", end_of_day=True)
    effective_ids = task_ids if task_ids is not None else None
    db = get_db(request)
    occurrences = await expand_active_calendar_occurrences(
        db,
        start,
        end,
        task_id=None if effective_ids is not None else task_id,
        task_ids=effective_ids,
    )
    await attach_dismissed_flag(db, source="recurring", items=occurrences)
    rows = [_as_api_recurring_row(occ) for occ in occurrences]

    if include_items:
        # Same projection path as agent query_window (item_projection + dismiss).
        raw_items = await fetch_item_occurrences_in_range(
            db,
            range_start=start,
            range_end=end,
            workset_id=None,
        )
        item_rows = [build_item_calendar_item(item) for item in raw_items]
        await attach_dismissed_flag(db, source="item", items=item_rows)
        rows.extend(_as_api_item_row(item) for item in item_rows)

    return rows

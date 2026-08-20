"""Unified calendar window (display + notify-scan SoT).

One GET merges analysis, user, recurring, and item_remind occurrences via
``query_window``. Intelligence pages and the board map keep ``GET /results/events``.
User-events / recurring CRUD stay on their own routes for 我的日程 editors.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.agent.tool_limits import CALENDAR_RESULT_HARD_CAP
from server.api.deps import get_db
from server.api.query_aliases import qalias
from server.api.schemas.responses import CalendarWindowItemResponse, CalendarWindowResponse
from server.calendar.query import query_window
from server.calendar.query_fetch import _FETCH_CAP
from server.errors import VALIDATION_ERROR, http_error
from server.time_iso import parse_iso

router = APIRouter(tags=["calendar"])

#: UI month/gantt windows need the fetch cap, not the agent tool cap (100).
_WINDOW_HARD_CAP = _FETCH_CAP
_WINDOW_DEFAULT_LIMIT = _FETCH_CAP


def _parse_range_param(value: str, name: str, *, end_of_day: bool = False):
    parsed = parse_iso(value, end_of_day=end_of_day)
    if parsed is None:
        raise http_error(422, f"Invalid {name}: {value}", error_code=VALIDATION_ERROR)
    return parsed


def _window_item_wire(row: dict[str, Any]) -> dict[str, Any]:
    payload = {**row}
    if payload.get("taskId") == "":
        payload["taskId"] = None
    if payload.get("seriesId") == "":
        payload["seriesId"] = None
    return CalendarWindowItemResponse.model_validate(payload).model_dump(mode="json")


@router.get("/window", response_model=CalendarWindowResponse)
async def list_calendar_window(
    request: Request,
    start: str | None = qalias("start", default=None),
    start_time: str | None = qalias("startTime", default=None),
    end: str | None = qalias("end", default=None),
    end_time: str | None = qalias("endTime", default=None),
    workset_id: str | None = qalias("worksetId", default=None),
    task_id: str | None = qalias("taskId", default=None),
    series_id: str | None = qalias("seriesId", default=None),
    include_analysis: bool = qalias("includeAnalysis", default=True),
    include_user: bool = qalias("includeUser", default=True),
    include_recurring: bool = qalias("includeRecurring", default=True),
    include_items: bool = qalias("includeItems", default=True),
    limit: int | None = qalias("limit", default=None),
    cursor: str | None = qalias("cursor", default=None),
) -> CalendarWindowResponse:
    range_start = start or start_time
    range_end = end or end_time
    if not range_start or not range_end:
        raise http_error(
            422,
            "start and end are required (ISO-8601)",
            error_code=VALIDATION_ERROR,
        )
    _parse_range_param(str(range_start), "start")
    _parse_range_param(str(range_end), "end", end_of_day=True)
    resolved_limit = _WINDOW_DEFAULT_LIMIT if limit is None else int(limit)
    try:
        result = await query_window(
            get_db(request),
            start=str(range_start),
            end=str(range_end),
            limit=resolved_limit,
            cursor=cursor,
            task_id=task_id,
            series_id=series_id,
            workset_id=workset_id,
            hard_cap=_WINDOW_HARD_CAP,
            include_analysis=bool(include_analysis),
            include_user=bool(include_user),
            include_recurring=bool(include_recurring),
            include_items=bool(include_items),
        )
    except ValueError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    items = [_window_item_wire(row) for row in result["items"]]
    return CalendarWindowResponse.model_validate(
        {
            "items": items,
            "limit": result["limit"],
            "cursor": result.get("cursor"),
            "nextCursor": result.get("nextCursor"),
        }
    )


# Keep agent cap imported so a drift test can compare UI vs tool ceilings.
assert _WINDOW_HARD_CAP >= CALENDAR_RESULT_HARD_CAP

"""Unified calendar occurrence expansion (shared by Timeline / Board / Gantt).

Returns RRULE expansions plus optional trackable-item DATE projections
(``source=item_remind``) from the same ``item_projection`` path used by agent
``query_window`` — one server projection, no FE dual-track.

Wire shape is ``CalendarOccurrenceResponse`` (Pydantic defaults fill optional
fields). Expansion / item_projection rows are coerced directly — no private
``_as_api_*`` reshape layer.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.deps import get_db
from server.api.query_aliases import qalias
from server.api.schemas.responses import CalendarOccurrenceResponse
from server.calendar.item_projection import fetch_item_occurrences_in_range
from server.calendar.query import expand_active_calendar_occurrences
from server.calendar.timeline_dismissals import attach_dismissed_flag
from server.calendar.timeline_importance import attach_important_flag
from server.errors import VALIDATION_ERROR, http_error
from server.time_iso import parse_iso

router = APIRouter(tags=["calendar"])


def _parse_range_param(value: str, name: str, *, end_of_day: bool = False):
    parsed = parse_iso(value, end_of_day=end_of_day)
    if parsed is None:
        raise http_error(422, f"Invalid {name}: {value}", error_code=VALIDATION_ERROR)
    return parsed


def _occurrence_wire(row: dict[str, Any], *, source: str) -> dict[str, Any]:
    """Coerce expansion / item_projection rows into CalendarOccurrenceResponse."""
    start = row["startTime"]
    end = row.get("endTime") or start
    payload = {
        **row,
        "startTime": start,
        "endTime": end,
        "source": source,
    }
    return CalendarOccurrenceResponse.model_validate(payload).model_dump(mode="json")


@router.get("/occurrences", response_model=list[CalendarOccurrenceResponse])
async def list_calendar_occurrences(
    request: Request,
    range_start: str | None = qalias("rangeStart", default=None),
    range_end: str | None = qalias("rangeEnd", default=None),
    series_id: str | None = qalias("seriesId", default=None),
    series_ids: list[str] | None = qalias("seriesIds", default=None),
    include_items: bool | None = qalias(
        "includeItems",
        default=None,
        description="Include trackable-item remind DATE projections (source=item_remind).",
    ),
) -> list[dict]:
    if not range_start or not range_end:
        raise http_error(
            422,
            "rangeStart and rangeEnd are required",
            error_code=VALIDATION_ERROR,
        )
    start = _parse_range_param(str(range_start), "rangeStart")
    end = _parse_range_param(str(range_end), "rangeEnd", end_of_day=True)
    resolved_include = True if include_items is None else bool(include_items)
    db = get_db(request)
    occurrences = await expand_active_calendar_occurrences(
        db,
        start,
        end,
        series_id=None if series_ids is not None else series_id,
        series_ids=series_ids,
    )
    await attach_dismissed_flag(db, source="recurring", items=occurrences)
    await attach_important_flag(db, source="recurring", items=occurrences)
    rows = [_occurrence_wire(occ, source="recurring") for occ in occurrences]

    if resolved_include:
        # Same projection path as agent query_window (item_projection + dismiss).
        item_rows = await fetch_item_occurrences_in_range(
            db,
            range_start=start,
            range_end=end,
            workset_id=None,
        )
        await attach_dismissed_flag(db, source="item_remind", items=item_rows)
        await attach_important_flag(db, source="item_remind", items=item_rows)
        rows.extend(_occurrence_wire(row, source="item_remind") for row in item_rows)
    return rows

"""Recurring series wire serializers."""

from __future__ import annotations

from typing import Any, Mapping

from server.util import parse_json_list
from server.wire.serializer_domains.tasks import _recurring_wire_clock


def serialize_recurring_series(row: Mapping[str, Any]) -> dict[str, Any]:
    """Flat ``RecurringSeriesResponse`` shape (not a TaskResponse)."""
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "description": row.get("description"),
        "rrule": row.get("rrule"),
        "eventStartTime": _recurring_wire_clock(row, "event_start_time"),
        "eventEndTime": _recurring_wire_clock(row, "event_end_time"),
        "eventIsAllDay": bool(row.get("event_is_all_day")),
        "eventLocation": row.get("event_location"),
        "eventDescription": row.get("event_description"),
        "eventTimezone": row.get("event_timezone"),
        "eventStartLocal": row.get("event_start_local"),
        "eventEndLocal": row.get("event_end_local"),
        "eventExdates": parse_json_list(row.get("event_exdates_json")),
        "eventRdates": parse_json_list(row.get("event_rdates_json")),
        "icsUid": row.get("ics_uid"),
        "icsSource": row.get("ics_source"),
        "isActive": bool(row.get("is_active")),
        "worksetId": row.get("workset_id") or "__user__",
        "parentTaskId": row.get("parent_task_id") or None,
        "itemId": row.get("item_id") or None,
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }

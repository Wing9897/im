"""Recurring series wire serializers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from server.domain.notify_prefs import normalize_notify_pref
from server.util import parse_json_list


def _recurring_wire_clock(row: Mapping[str, Any], key: str) -> Any:
    value = row.get(key)
    if not value:
        return value
    if row.get("event_is_all_day"):
        return None
    if row.get("ics_source") or str(row.get("event_timezone") or "") != "floating":
        return value
    text = str(value)
    if "T" in text and len(text) >= 16:
        return text.split("T", 1)[1][:5]
    return value


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
        "notifyPref": normalize_notify_pref(row.get("notify_pref")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }

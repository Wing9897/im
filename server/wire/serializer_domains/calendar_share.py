"""Calendar-share wire serializers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def serialize_catalog_wire_fields(row: Mapping[str, Any]) -> dict[str, str]:
    """Normalize remote or joined publish rows into catalog wire fields."""
    return {
        "description": str(row.get("description") or ""),
        "ownerAvatar": str(row.get("ownerAvatar") or row.get("owner_avatar") or ""),
        "cover": str(row.get("cover") or ""),
    }


def serialize_calendar_share_event(
    *,
    event_id: str,
    source: str,
    title: str,
    start_time: str | None,
    end_time: str | None = None,
    location: str | None = None,
    is_all_day: bool = False,
    timezone: str | None = None,
    emoji: str | None = None,
    task_id: str | None = None,
    series_id: str | None = None,
    workset_id: str | None = None,
    item_id: str | None = None,
    origin: str | None = None,
    item_date_kind: str | None = None,
    notify_pref: str | None = None,
    dismissed: bool = False,
    important: bool = False,
    task_name: str | None = None,
    is_last_occurrence: bool = False,
    remind_before_days: int | None = None,
    body: str | None = None,
    handle: str | None = None,
    slug: str | None = None,
) -> dict[str, Any]:
    return {
        "id": event_id,
        "source": source,
        "title": title,
        "startTime": start_time,
        "endTime": end_time,
        "location": location,
        "isAllDay": is_all_day,
        "timezone": timezone,
        "emoji": emoji,
        "taskId": task_id,
        "seriesId": series_id,
        "worksetId": workset_id,
        "itemId": item_id,
        "origin": origin,
        "itemDateKind": item_date_kind,
        "notifyPref": notify_pref,
        "dismissed": dismissed,
        "important": important,
        "taskName": task_name,
        "isLastOccurrence": is_last_occurrence,
        "remindBeforeDays": remind_before_days,
        "body": body,
        "handle": handle,
        "slug": slug,
    }

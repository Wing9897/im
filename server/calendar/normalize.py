"""Single builder for calendar item wire shapes (shared by ``server.calendar.query``).

Every calendar source — analysis events, RRULE occurrences, ``user_events`` —
has exactly one field mapping here, and the two shapes callers need are the
same mapping at two ``detail`` levels:

``full``
    Single-item detail (assistant ``calendar.get_event``): body, task name, and
    the source/provenance fields.
``compact``
    Merged list windows (timeline / upcoming / recent), a projection of ``full``
    down to the fields a list row renders.

Compact is derived from full rather than written out again, so a field can only
be added or renamed in one place.
"""

from __future__ import annotations

import re
from typing import Any, Iterable, Literal, Mapping

from server.util import parse_json_list

Source = Literal["analysis", "recurring", "user", "item"]
Detail = Literal["compact", "full"]

OCCURRENCE_ID_RE = re.compile(r"^([^:]+):(\d{8}T\d{6}Z)$")

#: Fields every compact list row carries.
_COMPACT_FIELDS = (
    "id",
    "taskId",
    "title",
    "startTime",
    "endTime",
    "location",
    "source",
    "isAllDay",
    "timezone",
)
#: Compact ``user`` rows additionally carry ownership workset, parent item, dismissal, importance.
_COMPACT_USER_FIELDS = _COMPACT_FIELDS + (
    "worksetId",
    "itemId",
    "origin",
    "dismissed",
    "important",
)
#: Compact RRULE rows may carry optional parent inventory item (linked calendar).
_COMPACT_OCCURRENCE_FIELDS = _COMPACT_FIELDS + ("itemId",)
#: Compact ``item`` rows carry ownership workset, date kind, dismissal, importance.
_COMPACT_ITEM_FIELDS = _COMPACT_FIELDS + (
    "worksetId",
    "itemId",
    "itemDateKind",
    "dismissed",
    "important",
)


def _text_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _project(item: dict[str, Any], detail: Detail, fields: Iterable[str]) -> dict[str, Any]:
    if detail == "full":
        return item
    return {field: item[field] for field in fields}


def event_sort_time(row: Mapping[str, Any]) -> str | None:
    """Effective calendar time: an analysis event may only have a source time."""
    for key in ("start_time", "source_message_time", "created_at"):
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def build_analysis_item(
    row: Mapping[str, Any],
    *,
    detail: Detail = "compact",
    dismissed: bool = False,
) -> dict[str, Any]:
    """Analysis event as a calendar item.

    Compact rows omit ``dismissed``: list windows stamp it in bulk afterwards
    via ``attach_dismissed_flag``.
    """
    item = {
        "id": str(row["id"]),
        "taskId": str(row.get("task_id") or ""),
        "title": str(row.get("title") or ""),
        "startTime": event_sort_time(row),
        "endTime": _text_or_none(row.get("end_time")),
        "location": _text_or_none(row.get("location")),
        "source": "analysis",
        "isAllDay": False,
        "timezone": None,
        "body": row.get("body") or "",
        "taskName": row.get("task_name"),
        "participants": parse_json_list(row.get("participants_json")),
        "sourcePlatform": row.get("source_platform"),
        "sourceChannelName": row.get("source_channel_name"),
        "sourceMessageId": row.get("source_message_id"),
        "createdAt": row.get("created_at"),
        "dismissed": bool(dismissed),
    }
    return _project(item, detail, _COMPACT_FIELDS)


def build_occurrence_item(
    occ: Mapping[str, Any],
    *,
    detail: Detail = "compact",
    dismissed: bool = False,
) -> dict[str, Any]:
    """RRULE occurrence as a calendar item (already camelCase from expansion)."""
    raw_item_id = occ.get("itemId")
    item_id = (
        str(raw_item_id).strip()
        if isinstance(raw_item_id, str) and str(raw_item_id).strip()
        else None
    )
    item = {
        "id": str(occ["id"]),
        "taskId": str(occ.get("taskId") or ""),
        "title": str(occ.get("title") or ""),
        "startTime": occ.get("startTime"),
        "endTime": occ.get("endTime"),
        "location": _text_or_none(occ.get("location")),
        "source": "recurring",
        "timezone": occ.get("timezone"),
        "body": occ.get("description") or "",
        "taskName": occ.get("taskName"),
        "isAllDay": bool(occ.get("isAllDay")),
        "rrule": occ.get("rrule"),
        "itemId": item_id,
        "dismissed": bool(dismissed),
    }
    return _project(item, detail, _COMPACT_OCCURRENCE_FIELDS)


def build_user_item(item: Mapping[str, Any], *, detail: Detail = "compact") -> dict[str, Any]:
    """User event as a calendar item.

    The input is already a ``serialize_user_event`` result (from
    ``server.wire.serializers``), which *is* the full
    shape (including ``dismissed``), so this only chooses the detail level.
    """
    return _project(dict(item), detail, _COMPACT_USER_FIELDS)


def build_item_calendar_item(item: Mapping[str, Any], *, detail: Detail = "compact") -> dict[str, Any]:
    """Item remind projection as a calendar item (``source=item``)."""
    return _project(dict(item), detail, _COMPACT_ITEM_FIELDS)


def matches_search(item: Mapping[str, Any], search: str | None) -> bool:
    if not search or not str(search).strip():
        return True
    needle = str(search).strip().lower()
    haystack = f"{item.get('title') or ''} {item.get('location') or ''}".lower()
    return needle in haystack


def clamp_limit(limit: int | None, default: int, hard_cap: int) -> int:
    if limit is None:
        return default
    return min(max(int(limit), 1), hard_cap)


def parse_cursor(cursor: str | None) -> int:
    if not cursor or not str(cursor).strip():
        return 0
    try:
        return max(int(str(cursor).strip()), 0)
    except ValueError:
        return 0

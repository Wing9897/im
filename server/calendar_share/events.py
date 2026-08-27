"""Project remote subscription events into timeline window items.

Accepts only the IC ``GET /me/subscriptions/events`` shape:
``{ calendars, events, series }`` with ``handle`` / ``slug`` on items.
``calendars[]`` may supply timezone for floating series.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from server.calendar.rrule import expand_calendar_occurrences
from server.calendar_share.snapshot import json_array_text
from server.calendar_share.store import calendar_key, normalize_handle, normalize_slug
from server.time_iso import parse_iso


def subscribed_source(handle: str, slug: str) -> str:
    return f"subscribed:{calendar_key(handle, slug)}"


def _object_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _identity(item: dict[str, Any]) -> tuple[str, str] | None:
    handle_raw = item.get("handle")
    slug_raw = item.get("slug")
    if not isinstance(handle_raw, str) or not isinstance(slug_raw, str):
        return None
    try:
        return normalize_handle(handle_raw), normalize_slug(slug_raw, allow_legacy=True)
    except Exception:
        return None


def _ic_payload(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    if "calendars" not in payload and "events" not in payload and "series" not in payload:
        return None
    return payload


def _calendar_timezones(payload: dict[str, Any]) -> dict[tuple[str, str], str]:
    out: dict[tuple[str, str], str] = {}
    for calendar in _object_list(payload.get("calendars")):
        identity = _identity(calendar)
        if identity is None:
            continue
        timezone = str(calendar.get("timezone") or "").strip()
        if timezone:
            out[identity] = timezone
    return out


def _overlaps_window(start: Any, end: Any, range_start: datetime, range_end: datetime) -> bool:
    start_dt = parse_iso(start) if isinstance(start, str) else None
    if start_dt is None:
        return False
    end_dt = parse_iso(end) if isinstance(end, str) else None
    if end_dt is None:
        end_dt = start_dt
    return start_dt < range_end and end_dt > range_start


def project_subscribed_events(payload: Any) -> list[dict[str, Any]]:
    """Flatten remote subscription events to calendar-window-like dicts."""
    body = _ic_payload(payload)
    if body is None:
        return []
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for item in _object_list(body.get("events")):
        identity = _identity(item)
        if identity is None:
            continue
        handle, slug = identity
        uid = str(item.get("uid") or "").strip()
        start = item.get("start")
        if not uid or not isinstance(start, str) or not start.strip():
            continue
        key = (handle, slug, uid)
        if key in seen:
            continue
        seen.add(key)
        end = item.get("end")
        title = str(item.get("title") or "")
        location = item.get("location")
        description = item.get("description")
        all_day = bool(item.get("allDay"))
        source = subscribed_source(handle, slug)
        out.append(
            {
                "id": f"{handle}/{slug}:{uid}",
                "source": source,
                "title": title,
                "startTime": start,
                "endTime": end if isinstance(end, str) and end.strip() else None,
                "location": str(location) if location else None,
                "isAllDay": all_day,
                "timezone": None,
                "emoji": None,
                "taskId": None,
                "seriesId": None,
                "worksetId": None,
                "itemId": None,
                "origin": None,
                "itemDateKind": None,
                "notifyPref": None,
                "dismissed": False,
                "important": False,
                "taskName": f"{handle}/{slug}",
                "isLastOccurrence": False,
                "remindBeforeDays": None,
                "body": str(description) if description else None,
                "handle": handle,
                "slug": slug,
            }
        )
    return out


def _series_to_expand_row(item: dict[str, Any], owner_timezone: str) -> dict[str, Any] | None:
    from server.calendar_share.timezone import is_floating_timezone

    uid = str(item.get("uid") or "").strip()
    rrule = str(item.get("rrule") or "").strip()
    dtstart = str(item.get("dtstart") or "").strip()
    if not uid or not rrule or not dtstart:
        return None
    if not bool(item.get("isActive", True)):
        return None
    dtend = str(item.get("dtend") or "") or ""
    stored_tz = str(item.get("timezone") or "") or ""
    timezone = owner_timezone if is_floating_timezone(stored_tz) else stored_tz
    return {
        "id": uid,
        "name": str(item.get("name") or item.get("title") or ""),
        "rrule": rrule,
        "event_start_time": dtstart,
        "event_start_local": dtstart,
        "event_end_time": dtend,
        "event_end_local": dtend,
        "event_is_all_day": bool(item.get("isAllDay")),
        "event_location": item.get("location") or "",
        "event_description": item.get("description") or "",
        "event_exdates_json": json_array_text(item.get("exdatesJson")),
        "event_rdates_json": json_array_text(item.get("rdatesJson")),
        "event_timezone": timezone,
        "event_timezone_ical": str(item.get("timezoneIcal") or "") or "",
        "is_active": True,
        "workset_id": None,
        "notify_pref": "off",
    }


def project_subscribed_series(
    payload: Any,
    range_start: datetime,
    range_end: datetime,
) -> list[dict[str, Any]]:
    """Expand remote RRULE series into the request window (Python, not React)."""
    body = _ic_payload(payload)
    if body is None:
        return []
    timezones = _calendar_timezones(body)
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for item in _object_list(body.get("series")):
        identity = _identity(item)
        if identity is None:
            continue
        handle, slug = identity
        row = _series_to_expand_row(item, timezones.get(identity, ""))
        if row is None:
            continue
        key = (handle, slug, str(row["id"]))
        if key in seen:
            continue
        seen.add(key)
        source = subscribed_source(handle, slug)
        for occ in expand_calendar_occurrences([row], range_start, range_end):
            occ_id = str(occ.get("id") or "")
            uid = str(occ.get("seriesId") or row["id"])
            out.append(
                {
                    "id": f"{handle}/{slug}:{occ_id}" if occ_id else f"{handle}/{slug}:{uid}",
                    "source": source,
                    "title": str(occ.get("title") or ""),
                    "startTime": occ.get("startTime"),
                    "endTime": occ.get("endTime"),
                    "location": occ.get("location") or None,
                    "isAllDay": bool(occ.get("isAllDay")),
                    "timezone": occ.get("timezone"),
                    "emoji": occ.get("emoji"),
                    "taskId": None,
                    "seriesId": uid,
                    "worksetId": None,
                    "itemId": None,
                    "origin": None,
                    "itemDateKind": None,
                    "notifyPref": "off",
                    "dismissed": False,
                    "important": False,
                    "taskName": occ.get("taskName") or f"{handle}/{slug}",
                    "isLastOccurrence": bool(occ.get("isLastOccurrence")),
                    "remindBeforeDays": None,
                    "body": occ.get("description") or None,
                    "handle": handle,
                    "slug": slug,
                }
            )
    return out


def project_subscription_window(
    payload: Any,
    range_start: datetime,
    range_end: datetime,
) -> list[dict[str, Any]]:
    """One-off remote events plus RRULE occurrences inside [range_start, range_end]."""
    events = [
        item
        for item in project_subscribed_events(payload)
        if _overlaps_window(item.get("startTime"), item.get("endTime"), range_start, range_end)
    ]
    return events + project_subscribed_series(payload, range_start, range_end)

"""Map local workset timeline rows to a remote snapshot (one-offs + unexpanded series)."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from server.calendar.query_fetch import fetch_workset_analysis_items, fetch_workset_item_remind_items
from server.calendar.user_events_read import list_user_events
from server.calendar_share.snapshot import json_array_text
from server.calendar_share.store import get_calendar_timezone
from server.db.database import Database
from server.queries.recurring_series_queries import list_series_rows
from server.time_iso import parse_iso, to_iso_z

#: One-off remote EventIn sources. Recurring stays in ``series[]`` unexpanded.
_REMOTE_ONE_OFF_SOURCES = frozenset({"", "user", "analysis", "item_remind"})


def _remote_event_end(start: str, end: Any) -> str:
    """IC rejects ``end <= start``. Missing or equal ends become start + 1s."""
    start_dt = parse_iso(start)
    text = end.strip() if isinstance(end, str) else ""
    end_dt = parse_iso(text) if text else None
    if start_dt is not None and end_dt is not None and end_dt > start_dt:
        return text
    if start_dt is None:
        return text or start
    bumped = start_dt + timedelta(seconds=1)
    if start.endswith(("Z", "z")):
        return to_iso_z(bumped)
    return bumped.replace(tzinfo=None).isoformat(timespec="seconds")


def snapshot_remote_events(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map local timeline rows to remote one-off events; skip dismissed.

    Includes user one-offs (task/item-linked included), analysis intel, and
    item_remind projections. Does not upload task_id/item_id/kind/notify/emoji.
    Public EventIn has no timezone field: pass local start/end strings as-is.
    """
    events: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        if item.get("dismissed"):
            continue
        source = str(item.get("source") or "user")
        if source not in _REMOTE_ONE_OFF_SOURCES:
            continue
        uid = str(item.get("id") or "").strip()
        start = item.get("startTime")
        if not uid or not isinstance(start, str) or not start.strip():
            continue
        if uid in seen:
            continue
        seen.add(uid)
        end = item.get("endTime")
        events.append(
            {
                "uid": uid,
                "start": start,
                "end": _remote_event_end(start, end),
                "title": str(item.get("title") or ""),
                "location": str(item.get("location") or ""),
                "description": str(item.get("body") or ""),
                "allDay": bool(item.get("isAllDay")),
            }
        )
    return events


def snapshot_remote_series(
    rows: list[dict[str, Any]],
    *,
    calendar_timezone: str = "",
) -> list[dict[str, Any]]:
    """Map recurring_schedules SQL rows to remote RRULE series (not expanded).

    Use raw ``event_start_local`` / ``event_start_time`` ISO values. Do not
    go through ``serialize_recurring_series`` (that can shrink floating TZ
    clocks to ``HH:MM``, which is invalid as remote ``dtstart``).

    Floating / empty series timezone is stamped with the household calendar
    IANA. Real TZIDs (ICS) are left unchanged. ``timezoneIcal`` is forwarded
    only when the series already stored one.
    """
    from server.calendar_share.timezone import is_floating_timezone

    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        if not bool(row.get("is_active", 1)):
            continue
        uid = str(row.get("id") or "").strip()
        rrule = str(row.get("rrule") or "").strip()
        dtstart = str(row.get("event_start_local") or row.get("event_start_time") or "").strip()
        if not uid or not rrule or not dtstart or uid in seen:
            continue
        seen.add(uid)
        location = row.get("event_location") or ""
        description = row.get("event_description") or row.get("description") or ""
        stored_tz = str(row.get("event_timezone") or "") or ""
        stored_ical = str(row.get("event_timezone_ical") or "") or ""
        timezone = calendar_timezone if is_floating_timezone(stored_tz) else stored_tz
        out.append(
            {
                "uid": uid,
                "name": str(row.get("name") or ""),
                "rrule": rrule,
                "dtstart": dtstart,
                "dtend": str(row.get("event_end_local") or row.get("event_end_time") or "") or "",
                "isAllDay": bool(row.get("event_is_all_day")),
                "location": str(location) if location else "",
                "description": str(description) if description else "",
                "timezone": timezone,
                "timezoneIcal": stored_ical,
                "exdatesJson": json_array_text(row.get("event_exdates_json")),
                "rdatesJson": json_array_text(row.get("event_rdates_json")),
                "isActive": True,
            }
        )
    return out


async def collect_workset_snapshot(db: Database, workset_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    user_rows = await list_user_events(db, workset_id=workset_id)
    analysis_rows = await fetch_workset_analysis_items(db, workset_id=workset_id)
    item_rows = await fetch_workset_item_remind_items(db, workset_id=workset_id)
    series_rows, _total = await list_series_rows(db, workset_id=workset_id)
    events = snapshot_remote_events([*user_rows, *analysis_rows, *item_rows])
    calendar_timezone = await get_calendar_timezone(db)
    return events, snapshot_remote_series(series_rows, calendar_timezone=calendar_timezone)

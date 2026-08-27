"""Push a local workset calendar to the public server (one-offs + RRULE series)."""

from __future__ import annotations

from typing import Any

from server.calendar.query_fetch import fetch_workset_analysis_items, fetch_workset_item_remind_items
from server.calendar.user_events_read import list_user_events
from server.calendar_share.remote import authorized_request, authorized_request_raw, raise_remote_status
from server.calendar_share.snapshot import (
    diff_uid_maps,
    fingerprint_maps,
    grants_content_hash,
    json_array_text,
    snapshot_unchanged,
)
from server.calendar_share.store import get_calendar_timezone, get_workset_entry, upsert_workset_entry
from server.db.database import Database
from server.errors import VALIDATION_ERROR, http_error
from server.queries.recurring_series_queries import list_series_rows
from server.util import utc_now_iso

#: One-off remote EventIn sources. Recurring stays in ``series[]`` unexpanded.
_REMOTE_ONE_OFF_SOURCES = frozenset({"", "user", "analysis", "item_remind"})


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
                "end": end if isinstance(end, str) and end.strip() else start,
                "title": str(item.get("title") or ""),
                "location": str(item.get("location") or "") or None,
                "description": str(item.get("body") or "") or None,
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


def _rows_by_uid(rows: list[dict[str, Any]], uids: list[str]) -> list[dict[str, Any]]:
    want = set(uids)
    return [row for row in rows if str(row.get("uid") or "") in want]


def _server_content_hash(payload: Any) -> str:
    if isinstance(payload, dict):
        value = payload.get("contentHash") or payload.get("content_hash")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


async def _put_full_snapshot(
    db: Database,
    *,
    slug: str,
    visibility: str,
    events: list[dict[str, Any]],
    series: list[dict[str, Any]],
) -> Any:
    return await authorized_request(
        db,
        method="PUT",
        path=f"/me/calendars/{slug}",
        json_body={
            "visibility": visibility,
            "publicVisibility": visibility,
            "events": events,
            "series": series,
        },
    )


async def _patch_or_put_snapshot(
    db: Database,
    *,
    slug: str,
    visibility: str,
    events: list[dict[str, Any]],
    series: list[dict[str, Any]],
    entry: dict[str, Any],
    current_fingerprints: dict[str, dict[str, str]],
) -> Any:
    """Incremental PATCH when a server ``events_hash`` receipt exists; otherwise full PUT.

    409 (baseHash mismatch) falls back to a full snapshot.
    ``baseHash`` is the last server ``contentHash`` (events_hash), not a local aggregate.
    Unpublish uses DELETE, not an empty PUT.
    """
    server_hash = str(entry.get("lastServerEventsHash") or "").strip()
    previous = entry.get("lastFingerprints") if isinstance(entry.get("lastFingerprints"), dict) else {}
    has_checkpoint = (
        bool(server_hash)
        and isinstance(previous.get("events"), dict)
        and isinstance(previous.get("series"), dict)
    )
    if not has_checkpoint:
        return await _put_full_snapshot(db, slug=slug, visibility=visibility, events=events, series=series)

    event_upsert_uids, event_delete_uids = diff_uid_maps(
        previous.get("events") or {}, current_fingerprints.get("events") or {}
    )
    series_upsert_uids, series_delete_uids = diff_uid_maps(
        previous.get("series") or {}, current_fingerprints.get("series") or {}
    )
    status, payload = await authorized_request_raw(
        db,
        method="PATCH",
        path=f"/me/calendars/{slug}/changes",
        json_body={
            "baseHash": server_hash,
            "visibility": visibility,
            "publicVisibility": visibility,
            "upsertEvents": _rows_by_uid(events, event_upsert_uids),
            "deleteEventUids": event_delete_uids,
            "upsertSeries": _rows_by_uid(series, series_upsert_uids),
            "deleteSeriesUids": series_delete_uids,
        },
    )
    if status == 409:
        return await _put_full_snapshot(db, slug=slug, visibility=visibility, events=events, series=series)
    if status >= 400:
        raise_remote_status(status, payload, fallback="Calendar share request failed")
    return payload


async def _delete_remote_calendar(db: Database, slug: str) -> None:
    status, payload = await authorized_request_raw(
        db,
        method="DELETE",
        path=f"/me/calendars/{slug}",
    )
    if status in (200, 204, 404):
        return
    raise_remote_status(status, payload, fallback="Calendar share unpublish failed")


def _cleared_unpublish_entry(entry: dict[str, Any], *, now: str) -> dict[str, Any]:
    next_entry = {
        **entry,
        "lastSyncAt": now,
        "lastError": None,
        "lastGrantsHash": None,
        "lastServerEventsHash": None,
        "lastPublicVisibility": None,
        "lastFingerprints": {"events": {}, "series": {}},
    }
    next_entry.pop("lastEventsHash", None)
    return next_entry


async def push_workset_calendar(
    db: Database,
    *,
    workset_id: str,
    entry: dict[str, Any],
    unpublish: bool = False,
) -> dict[str, Any]:
    slug = str(entry.get("slug") or "").strip()
    if not slug:
        raise http_error(422, "Slug is required to publish", error_code=VALIDATION_ERROR)
    visibility = str(entry.get("publicVisibility") or "off")
    grants = list(entry.get("grants") or [])
    if unpublish or not entry.get("enabled"):
        try:
            await _delete_remote_calendar(db, slug)
        except Exception as exc:
            await upsert_workset_entry(
                db,
                workset_id,
                {**entry, "lastError": str(exc), "lastSyncAt": entry.get("lastSyncAt")},
            )
            raise
        return await upsert_workset_entry(
            db,
            workset_id,
            _cleared_unpublish_entry(entry, now=utc_now_iso()),
        )

    events, series = await collect_workset_snapshot(db, workset_id)
    grants_hash = grants_content_hash(grants)
    current_fingerprints = fingerprint_maps(events, series)
    previous_fps = entry.get("lastFingerprints") if isinstance(entry.get("lastFingerprints"), dict) else {}
    skip_events = snapshot_unchanged(
        previous_fps,
        current_fingerprints,
        str(entry.get("lastPublicVisibility") or ""),
        visibility,
    )
    skip_grants = str(entry.get("lastGrantsHash") or "") == grants_hash
    remote_payload: Any = None
    try:
        if not skip_events:
            remote_payload = await _patch_or_put_snapshot(
                db,
                slug=slug,
                visibility=visibility,
                events=events,
                series=series,
                entry=entry,
                current_fingerprints=current_fingerprints,
            )
        if not skip_grants:
            await authorized_request(
                db,
                method="PUT",
                path=f"/me/calendars/{slug}/grants",
                json_body={"grants": grants},
            )
    except Exception as exc:
        await upsert_workset_entry(
            db,
            workset_id,
            {**entry, "lastError": str(exc), "lastSyncAt": entry.get("lastSyncAt")},
        )
        raise
    now = utc_now_iso()
    next_entry = {
        **entry,
        "lastSyncAt": now,
        "lastError": None,
        "lastGrantsHash": grants_hash,
    }
    next_entry.pop("lastEventsHash", None)
    if not skip_events:
        next_entry["lastFingerprints"] = current_fingerprints
        next_entry["lastPublicVisibility"] = visibility
        server_hash = _server_content_hash(remote_payload)
        if server_hash:
            next_entry["lastServerEventsHash"] = server_hash
    return await upsert_workset_entry(db, workset_id, next_entry)


async def mark_sync_error(db: Database, workset_id: str, message: str) -> dict[str, Any]:
    entry = await get_workset_entry(db, workset_id)
    return await upsert_workset_entry(db, workset_id, {**entry, "lastError": message})

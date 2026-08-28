"""Remote PUT / PATCH / DELETE for a published workset calendar."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException

from server.calendar_share.remote import (
    CalendarShareRemoteError,
    authorized_request,
    authorized_request_raw,
    raise_remote_status,
)
from server.calendar_share.snapshot import diff_uid_maps
from server.db.database import Database
from server.errors import CALENDAR_SHARE_REQUEST_FAILED, CALENDAR_SHARE_UNREACHABLE, diagnostic_error_fields

logger = logging.getLogger(__name__)


def exception_error_code(exc: BaseException) -> str:
    """Store lastError as a code, never a raw English protocol string."""
    if isinstance(exc, CalendarShareRemoteError) and exc.error_code:
        return exc.error_code
    code, _message = diagnostic_error_fields(exc)
    return code


def _http_status(exc: BaseException) -> int | None:
    if isinstance(exc, HTTPException):
        return exc.status_code
    if isinstance(exc, CalendarShareRemoteError):
        return exc.status
    return None


def _is_unreachable(exc: BaseException) -> bool:
    status = _http_status(exc)
    if status == 502:
        return True
    code = exception_error_code(exc)
    return code in {CALENDAR_SHARE_UNREACHABLE, CALENDAR_SHARE_REQUEST_FAILED}


def _is_write_rate_limited(exc: BaseException) -> bool:
    return _http_status(exc) == 429


def _rows_by_uid(rows: list[dict[str, Any]], uids: list[str]) -> list[dict[str, Any]]:
    want = set(uids)
    return [row for row in rows if str(row.get("uid") or "") in want]


async def put_full_snapshot(
    db: Database,
    *,
    slug: str,
    public_visibility: str,
    description: str,
    cover: str,
    events: list[dict[str, Any]],
    series: list[dict[str, Any]],
) -> Any:
    """PUT the full snapshot. Retry once on timeout; IC write-interval 429 means the first write landed."""
    body = {
        "publicVisibility": public_visibility,
        "description": description,
        "cover": cover,
        "events": events,
        "series": series,
    }

    async def _once() -> Any:
        return await authorized_request(
            db,
            method="PUT",
            path=f"/me/calendars/{slug}",
            json_body=body,
        )

    try:
        return await _once()
    except Exception as exc:
        if not _is_unreachable(exc):
            raise
        logger.info("Calendar snapshot PUT unreachable; retrying once (%s)", exc)
        try:
            return await _once()
        except Exception as retry_exc:
            if _is_write_rate_limited(retry_exc):
                logger.info("Calendar snapshot PUT retry hit write interval; treating as written")
                return {"contentHash": "", "assumedWritten": True}
            raise


async def patch_or_put_snapshot(
    db: Database,
    *,
    slug: str,
    public_visibility: str,
    description: str,
    cover: str,
    events: list[dict[str, Any]],
    series: list[dict[str, Any]],
    entry: dict[str, Any],
    current_fingerprints: dict[str, dict[str, str]],
) -> Any:
    """Incremental PATCH when a server ``events_hash`` receipt exists; otherwise full PUT.

    409 (baseHash mismatch) falls back to a full snapshot.
    Unpublish uses DELETE, not an empty PUT.
    Catalog (description/cover) and listing visibility ride on the same PATCH
    without re-uploading unchanged events.
    """
    server_hash = str(entry.get("lastServerEventsHash") or "").strip()
    raw_previous = entry.get("lastFingerprints")
    previous: dict[str, Any] = raw_previous if isinstance(raw_previous, dict) else {}
    previous_events = previous.get("events")
    previous_series = previous.get("series")
    has_checkpoint = bool(server_hash) and isinstance(previous_events, dict) and isinstance(previous_series, dict)
    if not has_checkpoint:
        return await put_full_snapshot(
            db,
            slug=slug,
            public_visibility=public_visibility,
            description=description,
            cover=cover,
            events=events,
            series=series,
        )

    event_upsert_uids, event_delete_uids = diff_uid_maps(
        previous_events or {}, current_fingerprints.get("events") or {}
    )
    series_upsert_uids, series_delete_uids = diff_uid_maps(
        previous_series or {}, current_fingerprints.get("series") or {}
    )
    status, payload = await authorized_request_raw(
        db,
        method="PATCH",
        path=f"/me/calendars/{slug}/changes",
        json_body={
            "baseHash": server_hash,
            "publicVisibility": public_visibility,
            "description": description,
            "cover": cover,
            "upsertEvents": _rows_by_uid(events, event_upsert_uids),
            "deleteEventUids": event_delete_uids,
            "upsertSeries": _rows_by_uid(series, series_upsert_uids),
            "deleteSeriesUids": series_delete_uids,
        },
    )
    if status == 409:
        return await put_full_snapshot(
            db,
            slug=slug,
            public_visibility=public_visibility,
            description=description,
            cover=cover,
            events=events,
            series=series,
        )
    if status >= 400:
        raise_remote_status(status, payload, fallback_code=CALENDAR_SHARE_REQUEST_FAILED)
    return payload


async def delete_remote_calendar(db: Database, slug: str) -> None:
    from server.errors import CALENDAR_SHARE_UNPUBLISH_FAILED

    status, payload = await authorized_request_raw(
        db,
        method="DELETE",
        path=f"/me/calendars/{slug}",
    )
    if status in (200, 204, 404):
        return
    raise_remote_status(status, payload, fallback_code=CALENDAR_SHARE_UNPUBLISH_FAILED)

"""Push a local workset calendar to the public server (one-offs + RRULE series)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from server.calendar_share.constants import (
    LISTING_PRIVATE_GROUP,
    MAX_EVENTS_PER_CALENDAR,
    canonicalize_listing_visibility,
)
from server.calendar_share.publish_remote import (
    delete_remote_calendar,
    exception_error_code,
    patch_or_put_snapshot,
)
from server.calendar_share.publish_snapshot import (
    collect_workset_snapshot,
    snapshot_remote_events,
    snapshot_remote_series,
)
from server.calendar_share.remote import authorized_request
from server.calendar_share.snapshot import fingerprint_maps, grants_content_hash, snapshot_unchanged
from server.calendar_share.store import delete_workset_entry, get_workset_entry, upsert_workset_entry
from server.db.database import Database
from server.errors import CALENDAR_EVENT_LIMIT, VALIDATION_ERROR, http_error
from server.queries.worksets_queries import fetch_workset_row
from server.util import utc_now_iso

logger = logging.getLogger(__name__)

__all__ = [
    "WorksetPushResult",
    "collect_workset_snapshot",
    "push_workset_calendar",
    "push_workset_calendar_result",
    "snapshot_remote_events",
    "snapshot_remote_series",
    "unpublish_workset_calendar",
]


def _server_content_hash(payload: Any) -> str:
    if isinstance(payload, dict):
        value = payload.get("contentHash") or payload.get("content_hash")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _workset_catalog(row: dict[str, Any] | None) -> tuple[str, str]:
    if not row:
        return "", ""
    return (
        str(row.get("description") or ""),
        str(row.get("cover_data_url") or ""),
    )


@dataclass(frozen=True)
class WorksetPushResult:
    entry: dict[str, Any]
    wrote_remote: bool


async def unpublish_workset_calendar(
    db: Database,
    *,
    workset_id: str,
    entry: dict[str, Any],
) -> dict[str, Any]:
    """DELETE the IC calendar then drop the local publish row."""
    slug = str(entry.get("slug") or "").strip()
    if slug:
        try:
            await delete_remote_calendar(db, slug)
        except Exception as exc:
            await upsert_workset_entry(
                db,
                workset_id,
                {**entry, "lastError": exception_error_code(exc), "lastSyncAt": entry.get("lastSyncAt")},
            )
            raise
    await delete_workset_entry(db, workset_id)
    from server.calendar_share.store import empty_workset_entry

    return empty_workset_entry(workset_id, slug=slug)


async def push_workset_calendar(
    db: Database,
    *,
    workset_id: str,
    entry: dict[str, Any],
    unpublish: bool = False,
) -> dict[str, Any]:
    result = await push_workset_calendar_result(db, workset_id=workset_id, entry=entry, unpublish=unpublish)
    return result.entry


async def push_workset_calendar_result(
    db: Database,
    *,
    workset_id: str,
    entry: dict[str, Any],
    unpublish: bool = False,
) -> WorksetPushResult:
    slug = str(entry.get("slug") or "").strip()
    if not slug:
        raise http_error(422, "Slug is required to publish", error_code=VALIDATION_ERROR)
    if unpublish or not str(entry.get("slug") or "").strip():
        saved = await unpublish_workset_calendar(db, workset_id=workset_id, entry=entry)
        return WorksetPushResult(entry=saved, wrote_remote=True)

    visibility = canonicalize_listing_visibility(entry.get("publicVisibility") or LISTING_PRIVATE_GROUP)
    grants = list(entry.get("grants") or [])
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
    workset_row = await fetch_workset_row(db, workset_id)
    description, cover = _workset_catalog(workset_row)
    skip_catalog = str(entry.get("lastDescription") or "") == description and str(entry.get("lastCover") or "") == cover
    skip_grants = str(entry.get("lastGrantsHash") or "") == grants_hash
    needs_catalog_push = not skip_catalog
    remote_payload: Any = None
    snapshot_written = False
    grants_written = skip_grants
    try:
        if len(events) > MAX_EVENTS_PER_CALENDAR:
            raise http_error(422, CALENDAR_EVENT_LIMIT, error_code=CALENDAR_EVENT_LIMIT)
        if not skip_events or needs_catalog_push:
            remote_payload = await patch_or_put_snapshot(
                db,
                slug=slug,
                public_visibility=visibility,
                description=description,
                cover=cover,
                events=events,
                series=series,
                entry=entry,
                current_fingerprints=current_fingerprints,
            )
            snapshot_written = True
        if not skip_grants:
            try:
                await authorized_request(
                    db,
                    method="PUT",
                    path=f"/me/calendars/{slug}/grants",
                    json_body={"grants": grants},
                )
                grants_written = True
            except Exception as grants_exc:
                if not snapshot_written:
                    raise
                logger.info("Calendar grants update failed after snapshot write: %s", grants_exc)
    except Exception as exc:
        await upsert_workset_entry(
            db,
            workset_id,
            {**entry, "lastError": exception_error_code(exc), "lastSyncAt": entry.get("lastSyncAt")},
        )
        raise
    now = utc_now_iso()
    next_entry = {
        **entry,
        "pendingSync": False,
        "lastSyncAt": now,
        "lastError": None,
    }
    if grants_written:
        next_entry["lastGrantsHash"] = grants_hash
    next_entry.pop("lastEventsHash", None)
    if not skip_events or needs_catalog_push:
        next_entry["lastDescription"] = description
        next_entry["lastCover"] = cover
        server_hash = _server_content_hash(remote_payload)
        if server_hash:
            next_entry["lastServerEventsHash"] = server_hash
    if not skip_events:
        next_entry["lastFingerprints"] = current_fingerprints
        next_entry["lastPublicVisibility"] = visibility
    saved = await upsert_workset_entry(db, workset_id, next_entry)
    return WorksetPushResult(entry=saved, wrote_remote=snapshot_written or not skip_grants)

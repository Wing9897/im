"""Local workset publish rows in ``calendar_share_publish``."""

from __future__ import annotations

import json
from typing import Any

from server.calendar_share.auto_sync_config import (
    DEFAULT_AUTO_SYNC_INTERVAL_SECONDS,
    normalize_auto_sync_interval_seconds,
    read_unified_auto_sync,
)
from server.calendar_share.constants import (
    LISTING_PRIVATE_GROUP,
    VISIBILITY_GRANT,
    canonicalize_listing_visibility,
    try_canonicalize_listing_visibility,
)
from server.calendar_share.store.normalize import normalize_handle, normalize_slug
from server.db.database import Database
from server.errors import VALIDATION_ERROR, http_error
from server.wire.serializers import serialize_catalog_wire_fields
from server.worksets_const import SYSTEM_WORKSET_ID

_EMPTY_FINGERPRINTS = {"events": {}, "series": {}}

PUBLISH_ROW_COLUMNS = (
    "workset_id, slug, public_visibility, grants_json, pending_sync, last_sync_at, "
    "last_error, last_grants_hash, last_server_events_hash, last_public_visibility, "
    "last_description, last_cover, last_fingerprints_json, auto_sync, auto_sync_interval_seconds"
)


def _clean_fingerprints(raw: Any) -> dict[str, dict[str, str]]:
    events: dict[str, str] = {}
    series: dict[str, str] = {}
    if isinstance(raw, dict):
        ev = raw.get("events")
        se = raw.get("series")
        if isinstance(ev, dict):
            events = {str(uid): str(digest) for uid, digest in ev.items() if str(uid).strip() and str(digest).strip()}
        if isinstance(se, dict):
            series = {str(uid): str(digest) for uid, digest in se.items() if str(uid).strip() and str(digest).strip()}
    return {"events": events, "series": series}


def _parse_fingerprints_json(raw: Any) -> dict[str, dict[str, str]]:
    if isinstance(raw, dict):
        return _clean_fingerprints(raw)
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            return dict(_EMPTY_FINGERPRINTS)
        return _clean_fingerprints(parsed)
    return dict(_EMPTY_FINGERPRINTS)


def _clean_grant(raw: Any) -> dict[str, str] | None:
    if not isinstance(raw, dict):
        return None
    try:
        handle = normalize_handle(str(raw.get("handle") or ""))
    except Exception:
        return None
    visibility = str(raw.get("visibility") or "").strip()
    if visibility not in VISIBILITY_GRANT:
        return None
    return {"handle": handle, "visibility": visibility}


def _clean_grants(raw: Any) -> list[dict[str, str]]:
    if isinstance(raw, str) and raw.strip():
        try:
            raw = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            raw = []
    grants: list[dict[str, str]] = []
    seen: set[str] = set()
    if not isinstance(raw, list):
        return grants
    for item in raw:
        grant = _clean_grant(item)
        if grant is None or grant["handle"] in seen:
            continue
        seen.add(grant["handle"])
        grants.append(grant)
    return grants


def _clean_workset_entry(workset_id: str, raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    slug_raw = str(raw.get("slug") or "").strip()
    if not slug_raw:
        return None
    try:
        slug = normalize_slug(slug_raw, allow_legacy=True)
    except Exception:
        return None
    visibility = canonicalize_listing_visibility(raw.get("publicVisibility") or LISTING_PRIVATE_GROUP)
    last_sync = str(raw.get("lastSyncAt") or "").strip() or None
    last_error = str(raw.get("lastError") or "").strip() or None
    last_grants_hash = str(raw.get("lastGrantsHash") or "").strip() or None
    last_server_events_hash = str(raw.get("lastServerEventsHash") or "").strip() or None
    last_public_visibility = try_canonicalize_listing_visibility(raw.get("lastPublicVisibility"))
    last_description = str(raw.get("lastDescription") or "")
    last_cover = str(raw.get("lastCover") or "")
    auto_sync = bool(raw.get("autoSync", True))
    auto_sync_interval = normalize_auto_sync_interval_seconds(
        raw.get("autoSyncIntervalSeconds", DEFAULT_AUTO_SYNC_INTERVAL_SECONDS)
    )
    return {
        "worksetId": workset_id,
        "slug": slug,
        "pendingSync": bool(raw.get("pendingSync")),
        "publicVisibility": visibility,
        "grants": _clean_grants(raw.get("grants")),
        "lastSyncAt": last_sync,
        "lastError": last_error,
        "lastGrantsHash": last_grants_hash,
        "lastServerEventsHash": last_server_events_hash,
        "lastPublicVisibility": last_public_visibility,
        "lastDescription": last_description,
        "lastCover": last_cover,
        "lastFingerprints": _clean_fingerprints(raw.get("lastFingerprints")),
        "autoSync": auto_sync,
        "autoSyncIntervalSeconds": auto_sync_interval,
    }


def _sql_row_to_entry(row: dict[str, Any]) -> dict[str, Any] | None:
    workset_id = str(row.get("workset_id") or "").strip()
    if not workset_id:
        return None
    fingerprints = _parse_fingerprints_json(row.get("last_fingerprints_json"))
    return _clean_workset_entry(
        workset_id,
        {
            "slug": row.get("slug"),
            "pendingSync": bool(row.get("pending_sync")),
            "publicVisibility": row.get("public_visibility"),
            "grants": _clean_grants(row.get("grants_json")),
            "lastSyncAt": row.get("last_sync_at"),
            "lastError": row.get("last_error"),
            "lastGrantsHash": row.get("last_grants_hash"),
            "lastServerEventsHash": row.get("last_server_events_hash"),
            "lastPublicVisibility": row.get("last_public_visibility"),
            "lastDescription": row.get("last_description") or "",
            "lastCover": row.get("last_cover") or "",
            "lastFingerprints": fingerprints,
            "autoSync": bool(row.get("auto_sync", 1)),
            "autoSyncIntervalSeconds": normalize_auto_sync_interval_seconds(
                row.get("auto_sync_interval_seconds", DEFAULT_AUTO_SYNC_INTERVAL_SECONDS)
            ),
        },
    )


def _with_household_auto_sync(
    entry: dict[str, Any],
    *,
    auto_sync: bool,
    interval_seconds: int,
) -> dict[str, Any]:
    """Row columns are a cache of household ``system_config`` auto-sync."""
    return {**entry, "autoSync": auto_sync, "autoSyncIntervalSeconds": interval_seconds}


def is_published_entry(entry: dict[str, Any] | None) -> bool:
    """True when a SQL publish row exists (non-empty slug)."""
    if not isinstance(entry, dict):
        return False
    return bool(str(entry.get("slug") or "").strip())


def empty_workset_entry(workset_id: str, *, slug: str = "") -> dict[str, Any]:
    return {
        "worksetId": workset_id,
        "slug": slug,
        "pendingSync": False,
        "publicVisibility": LISTING_PRIVATE_GROUP,
        "grants": [],
        "lastSyncAt": None,
        "lastError": None,
        "lastGrantsHash": None,
        "lastServerEventsHash": None,
        "lastPublicVisibility": None,
        "lastDescription": "",
        "lastCover": "",
        "lastFingerprints": {"events": {}, "series": {}},
        "autoSync": True,
        "autoSyncIntervalSeconds": DEFAULT_AUTO_SYNC_INTERVAL_SECONDS,
    }


def _joined_catalog_fields(row: dict[str, Any], *, missing: bool) -> dict[str, str]:
    if missing:
        return serialize_catalog_wire_fields({})
    return serialize_catalog_wire_fields(
        {
            "description": row.get("workset_description"),
            "cover": row.get("workset_cover"),
        }
    )


async def load_workset_map(db: Database) -> dict[str, dict[str, Any]]:
    household_on, household_interval = await read_unified_auto_sync(db)
    rows = await db.fetch_all(f"SELECT {PUBLISH_ROW_COLUMNS} FROM calendar_share_publish")
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        entry = _sql_row_to_entry(dict(row))
        if entry is not None:
            out[str(entry["worksetId"])] = _with_household_auto_sync(
                entry, auto_sync=household_on, interval_seconds=household_interval
            )
    return out


async def list_publish_joined(db: Database) -> list[dict[str, Any]]:
    """Publish rows LEFT JOIN worksets (unpublished worksets have no row)."""
    household_on, household_interval = await read_unified_auto_sync(db)
    rows = await db.fetch_all(
        """
        SELECT
            p.workset_id, p.slug, p.public_visibility, p.grants_json, p.pending_sync,
            p.last_sync_at, p.last_error, p.last_grants_hash, p.last_server_events_hash,
            p.last_public_visibility, p.last_description, p.last_cover, p.last_fingerprints_json,
            p.auto_sync, p.auto_sync_interval_seconds,
            w.name AS workset_name, w.description AS workset_description,
            w.cover_data_url AS workset_cover, w.is_system AS workset_is_system
        FROM calendar_share_publish p
        LEFT JOIN worksets w ON w.id = p.workset_id
        """
    )
    items: list[dict[str, Any]] = []
    for row in rows:
        data = dict(row)
        entry = _sql_row_to_entry(data)
        if entry is None:
            continue
        missing = data.get("workset_name") is None
        items.append(
            {
                **_with_household_auto_sync(entry, auto_sync=household_on, interval_seconds=household_interval),
                "worksetName": str(data.get("workset_name") or ""),
                "worksetMissing": missing,
                **_joined_catalog_fields(data, missing=missing),
                "isSystemWorkset": bool(data.get("workset_is_system")) or entry["worksetId"] == SYSTEM_WORKSET_ID,
            }
        )
    items.sort(
        key=lambda item: (
            bool(item["worksetMissing"]),
            str(item["worksetName"] or item["worksetId"]).casefold(),
            str(item["worksetId"]),
        )
    )
    return items


async def get_workset_entry(db: Database, workset_id: str) -> dict[str, Any]:
    household_on, household_interval = await read_unified_auto_sync(db)
    row = await db.fetch_one(
        f"SELECT {PUBLISH_ROW_COLUMNS} FROM calendar_share_publish WHERE workset_id = ?",
        (workset_id,),
    )
    if row is None:
        return _with_household_auto_sync(
            empty_workset_entry(workset_id),
            auto_sync=household_on,
            interval_seconds=household_interval,
        )
    entry = _sql_row_to_entry(dict(row))
    return _with_household_auto_sync(
        entry or empty_workset_entry(workset_id),
        auto_sync=household_on,
        interval_seconds=household_interval,
    )


async def upsert_workset_entry(db: Database, workset_id: str, entry: dict[str, Any]) -> dict[str, Any]:
    household_on, household_interval = await read_unified_auto_sync(db)
    entry = _with_household_auto_sync(entry, auto_sync=household_on, interval_seconds=household_interval)
    cleaned = _clean_workset_entry(workset_id, {**empty_workset_entry(workset_id), **entry, "worksetId": workset_id})
    if cleaned is None:
        raise http_error(422, "Invalid workset publish mapping", error_code=VALIDATION_ERROR)
    await db.execute(
        """
        INSERT INTO calendar_share_publish (
            workset_id, slug, public_visibility, grants_json, pending_sync,
            last_sync_at, last_error, last_grants_hash, last_server_events_hash,
            last_public_visibility, last_description, last_cover, last_fingerprints_json,
            auto_sync, auto_sync_interval_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workset_id) DO UPDATE SET
            slug = excluded.slug,
            public_visibility = excluded.public_visibility,
            grants_json = excluded.grants_json,
            pending_sync = excluded.pending_sync,
            last_sync_at = excluded.last_sync_at,
            last_error = excluded.last_error,
            last_grants_hash = excluded.last_grants_hash,
            last_server_events_hash = excluded.last_server_events_hash,
            last_public_visibility = excluded.last_public_visibility,
            last_description = excluded.last_description,
            last_cover = excluded.last_cover,
            last_fingerprints_json = excluded.last_fingerprints_json,
            auto_sync = excluded.auto_sync,
            auto_sync_interval_seconds = excluded.auto_sync_interval_seconds
        """,
        (
            workset_id,
            cleaned["slug"],
            cleaned["publicVisibility"],
            json.dumps(cleaned["grants"], ensure_ascii=False, separators=(",", ":")),
            1 if cleaned["pendingSync"] else 0,
            cleaned["lastSyncAt"],
            cleaned["lastError"],
            cleaned["lastGrantsHash"],
            cleaned["lastServerEventsHash"],
            cleaned["lastPublicVisibility"],
            cleaned["lastDescription"],
            cleaned["lastCover"],
            json.dumps(cleaned["lastFingerprints"], ensure_ascii=False, separators=(",", ":")),
            1 if cleaned["autoSync"] else 0,
            cleaned["autoSyncIntervalSeconds"],
        ),
    )
    return cleaned


async def delete_workset_entry(db: Database, workset_id: str) -> None:
    await db.execute("DELETE FROM calendar_share_publish WHERE workset_id = ?", (workset_id,))


async def mark_workset_pending(db: Database, *workset_ids: str) -> None:
    wanted = [str(wid).strip() for wid in workset_ids if str(wid or "").strip()]
    if not wanted:
        return
    household_on, _ = await read_unified_auto_sync(db)
    if not household_on:
        return
    placeholders = ",".join("?" for _ in wanted)
    await db.execute(
        f"""
        UPDATE calendar_share_publish SET pending_sync = 1
        WHERE workset_id IN ({placeholders})
          AND pending_sync = 0
          AND slug != ''
          AND (IFNULL(last_server_events_hash, '') != '' OR IFNULL(last_public_visibility, '') != '')
        """,
        tuple(wanted),
    )


async def mark_all_live_replicas_pending(db: Database) -> None:
    household_on, _ = await read_unified_auto_sync(db)
    if not household_on:
        return
    await db.execute(
        """
        UPDATE calendar_share_publish SET pending_sync = 1
        WHERE pending_sync = 0
          AND slug != ''
          AND (IFNULL(last_server_events_hash, '') != '' OR IFNULL(last_public_visibility, '') != '')
        """
    )

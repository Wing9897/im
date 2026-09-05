"""Row-level I/O for ``calendar_share_publish`` (SQL ↔ cleaned entry dicts).

Nothing here knows about the household auto-sync overlay; see
``publish_household_overlay`` for the wire-facing readers that stamp it on.
"""

from __future__ import annotations

import json
from typing import Any

from server.calendar_share.constants import (
    LISTING_PRIVATE_GROUP,
    VISIBILITY_GRANT,
    canonicalize_listing_visibility,
    try_canonicalize_listing_visibility,
)
from server.calendar_share.store.normalize import normalize_handle, normalize_slug
from server.db.database import Database

_EMPTY_FINGERPRINTS = {"events": {}, "series": {}}

PUBLISH_ROW_COLUMNS = (
    "workset_id, slug, public_visibility, grants_json, pending_sync, last_sync_at, "
    "last_error, last_grants_hash, last_server_events_hash, last_public_visibility, "
    "last_description, last_cover, last_fingerprints_json"
)

_PUBLISH_JOINED_SQL = """
SELECT
    p.workset_id, p.slug, p.public_visibility, p.grants_json, p.pending_sync,
    p.last_sync_at, p.last_error, p.last_grants_hash, p.last_server_events_hash,
    p.last_public_visibility, p.last_description, p.last_cover, p.last_fingerprints_json,
    w.name AS workset_name, w.description AS workset_description,
    w.cover_data_url AS workset_cover, w.is_system AS workset_is_system
FROM calendar_share_publish p
LEFT JOIN worksets w ON w.id = p.workset_id
"""

_LIVE_REPLICA_PREDICATE = (
    "pending_sync = 0 AND slug != '' "
    "AND (IFNULL(last_server_events_hash, '') != '' OR IFNULL(last_public_visibility, '') != '')"
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
        slug = normalize_slug(slug_raw)
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
    }


def sql_row_to_entry(row: dict[str, Any]) -> dict[str, Any] | None:
    """Map one ``calendar_share_publish`` row to a cleaned entry (``None`` if unusable)."""
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
        },
    )


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
    }


async def fetch_publish_rows(db: Database) -> list[dict[str, Any]]:
    rows = await db.fetch_all(f"SELECT {PUBLISH_ROW_COLUMNS} FROM calendar_share_publish")
    return [dict(row) for row in rows]


async def fetch_publish_rows_joined(db: Database) -> list[dict[str, Any]]:
    """Publish rows LEFT JOIN worksets (``workset_*`` columns are ``None`` when the workset is gone)."""
    rows = await db.fetch_all(_PUBLISH_JOINED_SQL)
    return [dict(row) for row in rows]


async def fetch_publish_row(db: Database, workset_id: str) -> dict[str, Any] | None:
    row = await db.fetch_one(
        f"SELECT {PUBLISH_ROW_COLUMNS} FROM calendar_share_publish WHERE workset_id = ?",
        (workset_id,),
    )
    return dict(row) if row is not None else None


async def write_workset_entry(db: Database, workset_id: str, cleaned: dict[str, Any]) -> None:
    """Upsert an already-cleaned entry (see ``_clean_workset_entry``)."""
    await db.execute(
        """
        INSERT INTO calendar_share_publish (
            workset_id, slug, public_visibility, grants_json, pending_sync,
            last_sync_at, last_error, last_grants_hash, last_server_events_hash,
            last_public_visibility, last_description, last_cover, last_fingerprints_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            last_fingerprints_json = excluded.last_fingerprints_json
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
        ),
    )


async def delete_workset_entry(db: Database, workset_id: str) -> None:
    await db.execute("DELETE FROM calendar_share_publish WHERE workset_id = ?", (workset_id,))


async def mark_live_replicas_pending(db: Database, workset_ids: list[str] | None = None) -> None:
    """Flag live replicas dirty; ``None`` means every row, else only the given worksets."""
    if workset_ids is None:
        await db.execute(f"UPDATE calendar_share_publish SET pending_sync = 1 WHERE {_LIVE_REPLICA_PREDICATE}")
        return
    if not workset_ids:
        return
    placeholders = ",".join("?" for _ in workset_ids)
    await db.execute(
        f"UPDATE calendar_share_publish SET pending_sync = 1 "
        f"WHERE workset_id IN ({placeholders}) AND {_LIVE_REPLICA_PREDICATE}",
        tuple(workset_ids),
    )

"""Encrypted tokens + local workset publish rows in ``calendar_share_publish``."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlsplit

from server.calendar_share.constants import (
    DEFAULT_BASE_URL,
    DEFAULT_GENERAL_SLUG,
    HANDLE_MAX_LEN,
    INVALID_SLUG_MESSAGE,
    KEY_ACCESS_TOKEN,
    KEY_BASE_URL,
    KEY_HANDLE,
    KEY_REFRESH_TOKEN,
    KEY_TIMEZONE,
    KEY_TIMEZONE_LAST_PUBLIC,
    KEY_TIMEZONE_PENDING,
    LISTING_PRIVATE_GROUP,
    SLUG_MAX_LEN,
    VISIBILITY_GRANT,
    canonicalize_listing_visibility,
    try_canonicalize_listing_visibility,
)
from server.config import get_config, set_configs
from server.db.database import Database
from server.errors import INVALID_CALENDAR_SLUG, VALIDATION_ERROR, http_error
from server.util import parse_bool
from server.worksets_const import SYSTEM_WORKSET_ID

_SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
#: Stored / remote slugs may start or end with underscore (pre-fix ``__general__``).
_LEGACY_SLUG_RE = re.compile(r"^[A-Za-z0-9._-]+$")
_HANDLE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_LEGACY_SUBSCRIPTIONS_KEY = "calendar_share_subscriptions"
_EMPTY_FINGERPRINTS = {"events": {}, "series": {}}


def normalize_base_url(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return DEFAULT_BASE_URL
    parsed = urlsplit(text)
    if parsed.scheme not in ("http", "https"):
        raise http_error(422, "Calendar share URL must be http or https", error_code=VALIDATION_ERROR)
    if not parsed.hostname:
        raise http_error(422, "Calendar share URL must include a hostname", error_code=VALIDATION_ERROR)
    if parsed.username or parsed.password:
        raise http_error(422, "Calendar share URL must not include credentials", error_code=VALIDATION_ERROR)
    return text.rstrip("/")


def normalize_handle(raw: str, *, field: str = "handle") -> str:
    text = (raw or "").strip()
    if not text or len(text) > HANDLE_MAX_LEN or not _HANDLE_RE.fullmatch(text):
        raise http_error(
            422,
            f"Invalid {field}: 1–{HANDLE_MAX_LEN} letters, digits, dot, underscore, or hyphen",
            error_code=VALIDATION_ERROR,
        )
    return text


def coerce_publish_slug(raw: str) -> str:
    """Map the builtin workset id to a write-valid default; leave other slugs as-is."""
    text = (raw or "").strip()
    if text == SYSTEM_WORKSET_ID:
        return DEFAULT_GENERAL_SLUG
    return text


def default_publish_slug(workset_title: str, workset_id: str) -> str:
    """Default remote slug for a local workset. ``__general__`` → ``general``."""
    if workset_id.strip() == SYSTEM_WORKSET_ID:
        return DEFAULT_GENERAL_SLUG

    def _candidate(raw: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("._-")
        return cleaned[:SLUG_MAX_LEN]

    from_title = _candidate(workset_title)
    if from_title and _SLUG_RE.fullmatch(from_title):
        return from_title
    from_id = _candidate(workset_id)
    if from_id and _SLUG_RE.fullmatch(from_id):
        return from_id
    return "calendar"


def normalize_slug(raw: str, *, allow_legacy: bool = False) -> str:
    text = (raw or "").strip()
    pattern = _LEGACY_SLUG_RE if allow_legacy else _SLUG_RE
    if not text or len(text) > SLUG_MAX_LEN or not pattern.fullmatch(text):
        raise http_error(
            422,
            INVALID_SLUG_MESSAGE,
            error_code=INVALID_CALENDAR_SLUG,
        )
    return text


def calendar_key(handle: str, slug: str) -> str:
    return f"{handle}/{slug}"


def parse_calendar_path(raw: str) -> tuple[str, str]:
    text = (raw or "").strip().strip("/")
    parts = [p for p in text.split("/") if p]
    if len(parts) != 2:
        raise http_error(422, "Expected handle/slug", error_code=VALIDATION_ERROR)
    return normalize_handle(parts[0]), normalize_slug(parts[1], allow_legacy=True)


async def get_base_url(db: Database) -> str:
    raw = (await get_config(db, KEY_BASE_URL)).strip()
    return raw.rstrip("/") if raw else DEFAULT_BASE_URL


async def get_handle(db: Database) -> str:
    return (await get_config(db, KEY_HANDLE)).strip()


async def get_access_token(db: Database) -> str:
    return (await get_config(db, KEY_ACCESS_TOKEN)).strip()


async def get_refresh_token(db: Database) -> str:
    return (await get_config(db, KEY_REFRESH_TOKEN)).strip()


async def session_connected(db: Database) -> bool:
    return bool(await get_access_token(db) or await get_refresh_token(db))


async def save_session(
    db: Database,
    *,
    base_url: str,
    handle: str,
    access_token: str,
    refresh_token: str,
) -> None:
    await set_configs(
        db,
        {
            KEY_BASE_URL: normalize_base_url(base_url),
            KEY_HANDLE: normalize_handle(handle),
            KEY_ACCESS_TOKEN: access_token.strip(),
            KEY_REFRESH_TOKEN: refresh_token.strip(),
        },
    )
    await drop_legacy_subscription_cache(db)


async def save_tokens(db: Database, *, access_token: str, refresh_token: str | None = None) -> None:
    updates = {KEY_ACCESS_TOKEN: access_token.strip()}
    if refresh_token is not None:
        updates[KEY_REFRESH_TOKEN] = refresh_token.strip()
    await set_configs(db, updates)


async def clear_tokens(db: Database) -> None:
    await set_configs(db, {KEY_ACCESS_TOKEN: "", KEY_REFRESH_TOKEN: ""})


async def clear_session(db: Database) -> None:
    await set_configs(
        db,
        {
            KEY_ACCESS_TOKEN: "",
            KEY_REFRESH_TOKEN: "",
        },
    )
    await drop_legacy_subscription_cache(db)


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
    last_emoji = str(raw.get("lastEmoji") or "")
    last_description = str(raw.get("lastDescription") or "")
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
        "lastEmoji": last_emoji,
        "lastDescription": last_description,
        "lastFingerprints": _clean_fingerprints(raw.get("lastFingerprints")),
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
            "lastEmoji": row.get("last_emoji") or "",
            "lastDescription": row.get("last_description") or "",
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
        "lastEmoji": "",
        "lastDescription": "",
        "lastFingerprints": {"events": {}, "series": {}},
    }


async def load_workset_map(db: Database) -> dict[str, dict[str, Any]]:
    rows = await db.fetch_all(
        "SELECT workset_id, slug, public_visibility, grants_json, pending_sync, last_sync_at, "
        "last_error, last_grants_hash, last_server_events_hash, last_public_visibility, "
        "last_emoji, last_description, last_fingerprints_json FROM calendar_share_publish"
    )
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        entry = _sql_row_to_entry(dict(row))
        if entry is not None:
            out[str(entry["worksetId"])] = entry
    return out


async def list_publish_joined(db: Database) -> list[dict[str, Any]]:
    """Publish rows LEFT JOIN worksets (unpublished worksets have no row)."""
    rows = await db.fetch_all(
        """
        SELECT
            p.workset_id, p.slug, p.public_visibility, p.grants_json, p.pending_sync,
            p.last_sync_at, p.last_error, p.last_grants_hash, p.last_server_events_hash,
            p.last_public_visibility, p.last_emoji, p.last_description, p.last_fingerprints_json,
            w.name AS workset_name, w.emoji AS workset_emoji, w.description AS workset_description,
            w.is_system AS workset_is_system
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
                **entry,
                "worksetName": str(data.get("workset_name") or ""),
                "worksetMissing": missing,
                "emoji": str(data.get("workset_emoji") or "") if not missing else "",
                "description": str(data.get("workset_description") or "") if not missing else "",
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
    row = await db.fetch_one(
        "SELECT workset_id, slug, public_visibility, grants_json, pending_sync, last_sync_at, "
        "last_error, last_grants_hash, last_server_events_hash, last_public_visibility, "
        "last_emoji, last_description, last_fingerprints_json FROM calendar_share_publish "
        "WHERE workset_id = ?",
        (workset_id,),
    )
    if row is None:
        return empty_workset_entry(workset_id)
    entry = _sql_row_to_entry(dict(row))
    return entry or empty_workset_entry(workset_id)


async def upsert_workset_entry(db: Database, workset_id: str, entry: dict[str, Any]) -> dict[str, Any]:
    cleaned = _clean_workset_entry(workset_id, {**empty_workset_entry(workset_id), **entry, "worksetId": workset_id})
    if cleaned is None:
        raise http_error(422, "Invalid workset publish mapping", error_code=VALIDATION_ERROR)
    await db.execute(
        """
        INSERT INTO calendar_share_publish (
            workset_id, slug, public_visibility, grants_json, pending_sync,
            last_sync_at, last_error, last_grants_hash, last_server_events_hash,
            last_public_visibility, last_emoji, last_description, last_fingerprints_json
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
            last_emoji = excluded.last_emoji,
            last_description = excluded.last_description,
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
            cleaned["lastEmoji"],
            cleaned["lastDescription"],
            json.dumps(cleaned["lastFingerprints"], ensure_ascii=False, separators=(",", ":")),
        ),
    )
    return cleaned


async def delete_workset_entry(db: Database, workset_id: str) -> None:
    await db.execute("DELETE FROM calendar_share_publish WHERE workset_id = ?", (workset_id,))


async def mark_workset_pending(db: Database, *workset_ids: str) -> None:
    wanted = [str(wid).strip() for wid in workset_ids if str(wid or "").strip()]
    if not wanted:
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
    await db.execute(
        """
        UPDATE calendar_share_publish SET pending_sync = 1
        WHERE pending_sync = 0
          AND slug != ''
          AND (IFNULL(last_server_events_hash, '') != '' OR IFNULL(last_public_visibility, '') != '')
        """
    )


async def drop_legacy_subscription_cache(db: Database) -> None:
    """Wipe leftover IM subscription cache only — never the rest of system_config."""
    await db.execute("DELETE FROM system_config WHERE key = ?", (_LEGACY_SUBSCRIPTIONS_KEY,))


async def get_calendar_timezone(db: Database) -> str:
    return (await get_config(db, KEY_TIMEZONE)).strip()


async def get_timezone_state(db: Database) -> dict[str, Any]:
    from server.calendar_share.timezone import system_iana_timezone

    timezone = await get_calendar_timezone(db)
    last_public = (await get_config(db, KEY_TIMEZONE_LAST_PUBLIC)).strip()
    pending = parse_bool(await get_config(db, KEY_TIMEZONE_PENDING))
    return {
        "timezone": timezone,
        "lastPublicTimezone": last_public,
        "pendingPublicTimezone": pending,
        "suggestedTimezone": system_iana_timezone(),
    }


async def save_calendar_timezone(db: Database, timezone: str) -> None:
    await set_configs(db, {KEY_TIMEZONE: timezone})


async def mark_public_timezone_result(db: Database, timezone: str, *, ok: bool) -> None:
    last_public = (await get_config(db, KEY_TIMEZONE_LAST_PUBLIC)).strip()
    if ok:
        await set_configs(
            db,
            {
                KEY_TIMEZONE_PENDING: "false",
                KEY_TIMEZONE_LAST_PUBLIC: timezone,
            },
        )
        return
    if timezone and timezone == last_public:
        await set_configs(db, {KEY_TIMEZONE_PENDING: "false"})
        return
    await set_configs(db, {KEY_TIMEZONE_PENDING: "true"})


async def sync_pending_public_timezone(db: Database) -> dict[str, Any]:
    """If a prior public replica write is pending, retry after login or explicit save."""
    from server.calendar_share.timezone import push_public_timezone

    state = await get_timezone_state(db)
    timezone = str(state["timezone"] or "")
    if not timezone or not state["pendingPublicTimezone"]:
        return state
    ok = await push_public_timezone(db, timezone)
    await mark_public_timezone_result(db, timezone, ok=ok)
    return await get_timezone_state(db)

"""Encrypted tokens + local workset/subscription mapping in system_config."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlsplit

from server.calendar_share.constants import (
    DEFAULT_BASE_URL,
    HANDLE_MAX_LEN,
    KEY_ACCESS_TOKEN,
    KEY_BASE_URL,
    KEY_HANDLE,
    KEY_REFRESH_TOKEN,
    KEY_TIMEZONE,
    KEY_TIMEZONE_LAST_PUBLIC,
    KEY_TIMEZONE_PENDING,
    KEY_WORKSETS,
    SLUG_MAX_LEN,
    VISIBILITY_GRANT,
    VISIBILITY_PUBLIC,
)
from server.config import get_config, set_configs
from server.db.database import Database
from server.errors import VALIDATION_ERROR, http_error
from server.util import parse_bool, parse_json_dict

_SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_HANDLE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


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


def normalize_slug(raw: str) -> str:
    text = (raw or "").strip()
    if not text or len(text) > SLUG_MAX_LEN or not _SLUG_RE.fullmatch(text):
        raise http_error(
            422,
            f"Invalid slug: 1–{SLUG_MAX_LEN} letters, digits, dot, underscore, or hyphen",
            error_code=VALIDATION_ERROR,
        )
    return text


_LEGACY_SUBSCRIPTIONS_KEY = "calendar_share_subscriptions"


def calendar_key(handle: str, slug: str) -> str:
    return f"{handle}/{slug}"


def parse_calendar_path(raw: str) -> tuple[str, str]:
    text = (raw or "").strip().strip("/")
    parts = [p for p in text.split("/") if p]
    if len(parts) != 2:
        raise http_error(422, "Expected handle/slug", error_code=VALIDATION_ERROR)
    return normalize_handle(parts[0]), normalize_slug(parts[1])


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
    visibility = str(raw.get("publicVisibility") or "off").strip()
    if visibility not in VISIBILITY_PUBLIC:
        visibility = "off"
    grants: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in raw.get("grants") or []:
        grant = _clean_grant(item)
        if grant is None or grant["handle"] in seen:
            continue
        seen.add(grant["handle"])
        grants.append(grant)
    last_sync = str(raw.get("lastSyncAt") or "").strip() or None
    last_error = str(raw.get("lastError") or "").strip() or None
    last_grants_hash = str(raw.get("lastGrantsHash") or "").strip() or None
    last_server_events_hash = str(raw.get("lastServerEventsHash") or "").strip() or None
    last_public_visibility = str(raw.get("lastPublicVisibility") or "").strip() or None
    if last_public_visibility is not None and last_public_visibility not in VISIBILITY_PUBLIC:
        last_public_visibility = None
    return {
        "worksetId": workset_id,
        "slug": slug,
        "enabled": bool(raw.get("enabled")),
        "autoSync": bool(raw.get("autoSync")),
        "publicVisibility": visibility,
        "grants": grants,
        "lastSyncAt": last_sync,
        "lastError": last_error,
        "lastGrantsHash": last_grants_hash,
        "lastServerEventsHash": last_server_events_hash,
        "lastPublicVisibility": last_public_visibility,
        "lastFingerprints": _clean_fingerprints(raw.get("lastFingerprints")),
    }


async def load_workset_map(db: Database) -> dict[str, dict[str, Any]]:
    raw = parse_json_dict(await get_config(db, KEY_WORKSETS))
    out: dict[str, dict[str, Any]] = {}
    for key, value in raw.items():
        workset_id = str(key).strip()
        if not workset_id:
            continue
        entry = _clean_workset_entry(workset_id, value)
        if entry is not None:
            out[workset_id] = entry
    return out


async def save_workset_map(db: Database, mapping: dict[str, dict[str, Any]]) -> None:
    payload: dict[str, Any] = {}
    for workset_id, entry in mapping.items():
        cleaned = _clean_workset_entry(str(workset_id), entry)
        if cleaned is not None:
            payload[str(workset_id)] = cleaned
    await set_configs(db, {KEY_WORKSETS: json.dumps(payload, ensure_ascii=False, separators=(",", ":"))})


def empty_workset_entry(workset_id: str, *, slug: str = "") -> dict[str, Any]:
    return {
        "worksetId": workset_id,
        "slug": slug,
        "enabled": False,
        "autoSync": False,
        "publicVisibility": "off",
        "grants": [],
        "lastSyncAt": None,
        "lastError": None,
        "lastGrantsHash": None,
        "lastServerEventsHash": None,
        "lastPublicVisibility": None,
        "lastFingerprints": {"events": {}, "series": {}},
    }


async def get_workset_entry(db: Database, workset_id: str) -> dict[str, Any]:
    mapping = await load_workset_map(db)
    return mapping.get(workset_id) or empty_workset_entry(workset_id)


async def upsert_workset_entry(db: Database, workset_id: str, entry: dict[str, Any]) -> dict[str, Any]:
    mapping = await load_workset_map(db)
    cleaned = _clean_workset_entry(workset_id, {**empty_workset_entry(workset_id), **entry, "worksetId": workset_id})
    if cleaned is None:
        raise http_error(422, "Invalid workset publish mapping", error_code=VALIDATION_ERROR)
    mapping[workset_id] = cleaned
    await save_workset_map(db, mapping)
    return cleaned


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

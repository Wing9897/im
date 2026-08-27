"""Pinned household calendar IANA timezone (not follow-system)."""

from __future__ import annotations

import os
from datetime import UTC, datetime, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException

from server.calendar_share.remote import CalendarShareRemoteError, authorized_request
from server.calendar_share.store import session_connected
from server.db.database import Database
from server.errors import VALIDATION_ERROR, http_error

_FLOATING_SENTINELS = frozenset({"", "floating", "local", "system"})
_UTC_ALIASES = frozenset({"UTC", "ETC/UTC", "GMT"})
_IANA_MAX_LEN = 64


def is_floating_timezone(raw: str | None) -> bool:
    return (raw or "").strip().casefold() in _FLOATING_SENTINELS


def tzinfo_from_iana(name: str | None) -> tzinfo | None:
    """Resolve a stored IANA id. Empty/floating → None (caller uses host TZ)."""
    text = (name or "").strip()
    if is_floating_timezone(text):
        return None
    if text.upper() in _UTC_ALIASES:
        return UTC
    try:
        return ZoneInfo(text)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return None


def normalize_iana_timezone(raw: str, *, field: str = "timezone") -> str:
    text = (raw or "").strip()
    if not text or len(text) > _IANA_MAX_LEN or is_floating_timezone(text):
        raise http_error(
            422,
            f"Invalid {field}: IANA city id required (e.g. Asia/Hong_Kong)",
            error_code=VALIDATION_ERROR,
        )
    if text.upper() in _UTC_ALIASES:
        return "UTC"
    try:
        ZoneInfo(text)
    except (ZoneInfoNotFoundError, ValueError, OSError) as exc:
        raise http_error(
            422,
            f"Invalid {field}: unknown IANA timezone",
            error_code=VALIDATION_ERROR,
        ) from exc
    return text


def system_iana_timezone() -> str:
    """Best-effort host IANA for GUI prefill. Never a persistent follow-system mode."""
    tz = datetime.now().astimezone().tzinfo
    key = getattr(tz, "key", None)
    if isinstance(key, str) and key.strip():
        resolved = tzinfo_from_iana(key.strip())
        if resolved is not None:
            return key.strip()
    env = (os.environ.get("TZ") or "").strip()
    if env:
        resolved = tzinfo_from_iana(env)
        if resolved is not None:
            return env if env.upper() not in _UTC_ALIASES else "UTC"
    return ""


async def push_public_timezone(db: Database, timezone: str) -> bool:
    """PUT account timezone on the public server. False if offline or the replica failed."""
    if not await session_connected(db):
        return False
    try:
        await authorized_request(db, method="PUT", path="/me/timezone", json_body={"timezone": timezone})
    except (HTTPException, CalendarShareRemoteError):
        return False
    return True

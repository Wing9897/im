"""Device session verification, touch, revoke, and listing."""

from __future__ import annotations

import secrets
import time
from typing import Any

from server.auth.admin_auth import has_admin_account
from server.auth.device_token_issue import _hash_secret, _not_expired, _utcnow
from server.config import get_config_bool, set_configs
from server.db.database import Database
from server.util import utc_now_iso

# Throttle last_seen writes during normal API traffic.
_TOUCH_INTERVAL_S = 300.0
_last_touch_monotonic: dict[str, float] = {}


async def count_active_device_sessions(db: Database) -> int:
    count = await db.fetch_value("SELECT COUNT(*) FROM device_sessions WHERE revoked_at IS NULL")
    return int(count or 0)


async def has_active_device_session(db: Database) -> bool:
    return await count_active_device_sessions(db) > 0


async def is_bootstrapped(db: Database) -> bool:
    """True when the household admin account exists."""
    return await has_admin_account(db)


async def mark_household_secured(db: Database) -> None:
    """Record first-run completion and require Bearer on loopback."""
    await set_configs(
        db,
        {
            "setup_complete": "true",
            "localhost_auth_exempt": "false",
        },
    )


async def credentials_configured(db: Database) -> bool:
    """True when any household auth path exists (keys, admin, setup, or device sessions).

    Used to distinguish 503 AUTH_SETUP_REQUIRED (nothing configured) from 401
    (credentials exist but the presented Bearer is invalid). Active device
    sessions count — otherwise a valid session + bad token incorrectly yields 503.
    """
    from server.auth.access_keys import access_keys_configured

    if await access_keys_configured(db):
        return True
    if await is_bootstrapped(db):
        return True
    if await get_config_bool(db, "setup_complete"):
        return True
    session_count = await db.fetch_value("SELECT COUNT(*) FROM device_sessions WHERE revoked_at IS NULL")
    return int(session_count or 0) > 0


async def resolve_session_id_for_access_token(db: Database, token: str) -> str | None:
    """Return session id when the access token is present, unrevoked, and unexpired."""
    presented = (token or "").strip()
    if not presented:
        return None
    token_hash = _hash_secret(presented)
    row = await db.fetch_one(
        """
        SELECT t.session_id, t.token_hash, t.expires_at, t.revoked_at,
               s.revoked_at AS session_revoked_at, s.expires_at AS session_expires_at
        FROM device_access_tokens t
        JOIN device_sessions s ON s.id = t.session_id
        WHERE t.token_hash = ?
        """,
        (token_hash,),
    )
    if row is None:
        return None
    if not secrets.compare_digest(str(row["token_hash"]), token_hash):
        return None
    if row["revoked_at"] or row["session_revoked_at"]:
        return None
    now = _utcnow()
    if not _not_expired(str(row["expires_at"]), now=now):
        return None
    if not _not_expired(str(row["session_expires_at"]), now=now):
        return None
    return str(row["session_id"])


async def touch_session(db: Database, session_id: str) -> None:
    await db.execute(
        "UPDATE device_sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL",
        (utc_now_iso(), session_id),
    )


async def maybe_touch_session(db: Database, session_id: str) -> None:
    """Update last_seen at most once per ``_TOUCH_INTERVAL_S`` per session."""
    sid = (session_id or "").strip()
    if not sid:
        return
    now_mono = time.monotonic()
    last = _last_touch_monotonic.get(sid, 0.0)
    if now_mono - last < _TOUCH_INTERVAL_S:
        return
    _last_touch_monotonic[sid] = now_mono
    await touch_session(db, sid)


async def revoke_session(db: Database, session_id: str) -> bool:
    now = utc_now_iso()
    row = await db.fetch_one(
        "SELECT id, revoked_at FROM device_sessions WHERE id = ?",
        (session_id,),
    )
    if row is None:
        return False
    if row["revoked_at"]:
        return True
    await db.execute(
        "UPDATE device_sessions SET revoked_at = ? WHERE id = ?",
        (now, session_id),
    )
    await db.execute(
        """
        UPDATE device_access_tokens
        SET revoked_at = ?
        WHERE session_id = ? AND revoked_at IS NULL
        """,
        (now, session_id),
    )
    return True


async def revoke_session_for_access_token(db: Database, access_token: str) -> bool:
    session_id = await resolve_session_id_for_access_token(db, access_token)
    if session_id is None:
        return False
    return await revoke_session(db, session_id)


async def list_devices(db: Database, *, current_session_id: str | None = None) -> list[dict[str, Any]]:
    rows = await db.fetch_all(
        """
        SELECT id, label, created_at, last_seen_at, expires_at, revoked_at
        FROM device_sessions
        WHERE revoked_at IS NULL
        ORDER BY created_at ASC
        """
    )
    return [
        {
            "id": row["id"],
            "label": row["label"],
            "createdAt": row["created_at"],
            "lastSeenAt": row["last_seen_at"],
            "expiresAt": row["expires_at"],
            "current": bool(current_session_id and row["id"] == current_session_id),
        }
        for row in rows
    ]

"""Device sessions: opaque access/refresh tokens bound to the household.

Tokens are random opaque strings; only SHA-256 hashes are stored. Verification
uses ``secrets.compare_digest``. Access TTL 1h; refresh TTL 90d.
"""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from server.admin_auth import has_admin_account
from server.config import get_config_bool, set_configs
from server.db.database import Database, TransactionDb
from server.time_iso import parse_iso, to_iso_z
from server.util import new_id, utc_now_iso

ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=90)
# Throttle last_seen writes during normal API traffic.
_TOUCH_INTERVAL_S = 300.0
_last_touch_monotonic: dict[str, float] = {}


class _RefreshAborted(Exception):
    """Rollback marker for failed atomic refresh CAS."""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _new_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def _iso_after(delta: timedelta) -> str:
    return to_iso_z(_utcnow() + delta)


def _not_expired(expires_at: str, *, now: datetime | None = None) -> bool:
    parsed = parse_iso(expires_at)
    if parsed is None:
        return False
    return parsed > (now or _utcnow())


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
    from server.access_keys import access_keys_configured

    if await access_keys_configured(db):
        return True
    if await is_bootstrapped(db):
        return True
    if await get_config_bool(db, "setup_complete"):
        return True
    session_count = await db.fetch_value("SELECT COUNT(*) FROM device_sessions WHERE revoked_at IS NULL")
    return int(session_count or 0) > 0


async def resolve_session_id_for_access_token(db: Database, token: str) -> Optional[str]:
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


async def _issue_tokens(
    db: Database,
    *,
    label: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    now = utc_now_iso()
    access_plain = _new_opaque_token()
    refresh_plain = _new_opaque_token()
    access_expires = _iso_after(ACCESS_TTL)
    refresh_expires = _iso_after(REFRESH_TTL)
    clean_label = (label or "").strip()[:80] or "Device"

    # Session row and access token commit together: a half-written pair leaves a
    # session that can never authenticate and can never be refreshed.
    async with db.transaction() as conn:
        tdb = TransactionDb(conn)
        if session_id is None:
            session_id = new_id()
            await tdb.execute(
                """
                INSERT INTO device_sessions
                    (id, label, refresh_token_hash, created_at, last_seen_at, expires_at, revoked_at)
                VALUES (?, ?, ?, ?, ?, ?, NULL)
                """,
                (session_id, clean_label, _hash_secret(refresh_plain), now, now, refresh_expires),
            )
        else:
            await tdb.execute(
                """
                UPDATE device_sessions
                SET refresh_token_hash = ?, last_seen_at = ?, expires_at = ?, revoked_at = NULL
                WHERE id = ?
                """,
                (_hash_secret(refresh_plain), now, refresh_expires, session_id),
            )
            # Revoke prior access tokens for this session (rotation).
            await tdb.execute(
                """
                UPDATE device_access_tokens
                SET revoked_at = ?
                WHERE session_id = ? AND revoked_at IS NULL
                """,
                (now, session_id),
            )

        await tdb.execute(
            """
            INSERT INTO device_access_tokens
                (id, session_id, token_hash, created_at, expires_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, NULL)
            """,
            (new_id(), session_id, _hash_secret(access_plain), now, access_expires),
        )

        session = await tdb.fetch_one("SELECT * FROM device_sessions WHERE id = ?", (session_id,))
        assert session is not None
    return {
        "accessToken": access_plain,
        "refreshToken": refresh_plain,
        "accessExpiresAt": access_expires,
        "refreshExpiresAt": refresh_expires,
        "device": {
            "id": session_id,
            "label": session["label"],
            "createdAt": session["created_at"],
            "lastSeenAt": session["last_seen_at"],
            "expiresAt": session["expires_at"],
        },
    }


async def create_device_session(db: Database, *, label: str = "Device") -> dict[str, Any]:
    return await _issue_tokens(db, label=label)


async def refresh_device_session(db: Database, refresh_token: str) -> dict[str, Any] | None:
    """Rotate tokens atomically; CAS on refresh_token_hash requires rowcount==1."""
    presented = (refresh_token or "").strip()
    if not presented:
        return None
    old_hash = _hash_secret(presented)
    access_plain = _new_opaque_token()
    refresh_plain = _new_opaque_token()
    access_expires = _iso_after(ACCESS_TTL)
    refresh_expires = _iso_after(REFRESH_TTL)
    now = utc_now_iso()
    new_refresh_hash = _hash_secret(refresh_plain)
    new_access_hash = _hash_secret(access_plain)
    access_id = new_id()

    try:
        async with db.transaction() as conn:
            tdb = TransactionDb(conn)
            row = await tdb.fetch_one(
                """
                SELECT id, label, refresh_token_hash, created_at, expires_at, revoked_at
                FROM device_sessions
                WHERE refresh_token_hash = ?
                """,
                (old_hash,),
            )
            if row is None:
                raise _RefreshAborted()
            if not secrets.compare_digest(str(row["refresh_token_hash"]), old_hash):
                raise _RefreshAborted()
            if row["revoked_at"]:
                raise _RefreshAborted()
            if not _not_expired(str(row["expires_at"])):
                raise _RefreshAborted()

            session_id = str(row["id"])
            updated = await tdb.execute(
                """
                UPDATE device_sessions
                SET refresh_token_hash = ?, last_seen_at = ?, expires_at = ?
                WHERE refresh_token_hash = ? AND revoked_at IS NULL
                """,
                (new_refresh_hash, now, refresh_expires, old_hash),
            )
            if updated != 1:
                raise _RefreshAborted()

            await tdb.execute(
                """
                UPDATE device_access_tokens
                SET revoked_at = ?
                WHERE session_id = ? AND revoked_at IS NULL
                """,
                (now, session_id),
            )
            await tdb.execute(
                """
                INSERT INTO device_access_tokens
                    (id, session_id, token_hash, created_at, expires_at, revoked_at)
                VALUES (?, ?, ?, ?, ?, NULL)
                """,
                (access_id, session_id, new_access_hash, now, access_expires),
            )
            device = {
                "id": session_id,
                "label": str(row["label"]),
                "createdAt": row["created_at"],
                "lastSeenAt": now,
                "expiresAt": refresh_expires,
            }
    except _RefreshAborted:
        return None

    return {
        "accessToken": access_plain,
        "refreshToken": refresh_plain,
        "accessExpiresAt": access_expires,
        "refreshExpiresAt": refresh_expires,
        "device": device,
    }


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
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "id": row["id"],
                "label": row["label"],
                "createdAt": row["created_at"],
                "lastSeenAt": row["last_seen_at"],
                "expiresAt": row["expires_at"],
                "current": bool(current_session_id and row["id"] == current_session_id),
            }
        )
    return out

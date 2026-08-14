"""Opaque access/refresh token issuance and rotation for device sessions."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from server.db.database import Database, TransactionDb
from server.time_iso import parse_iso, to_iso_z
from server.util import utc_now_iso

ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=90)


class _RefreshAborted(Exception):
    """Rollback marker for failed atomic refresh CAS."""


def _utcnow() -> datetime:
    return datetime.now(UTC)


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


async def _issue_tokens(
    db: Database,
    *,
    label: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    # Resolve through the façade so tests can monkeypatch ``device_auth.new_id``.
    from server.auth import device_auth as device_auth_facade

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
            session_id = device_auth_facade.new_id()
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
            (device_auth_facade.new_id(), session_id, _hash_secret(access_plain), now, access_expires),
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
    from server.auth import device_auth as device_auth_facade

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
    access_id = device_auth_facade.new_id()

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

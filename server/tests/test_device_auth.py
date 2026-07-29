"""Unit tests for device_auth helpers (expiry, revoke, refresh CAS)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from server.admin_auth import create_admin_account
from server.device_auth import (
    ACCESS_TTL,
    create_device_session,
    has_active_device_session,
    is_bootstrapped,
    mark_household_secured,
    refresh_device_session,
    resolve_session_id_for_access_token,
    revoke_session,
)
from server.time_iso import to_iso_z
from server.util import utc_now_iso


@pytest.mark.asyncio
async def test_create_and_validate_access_token(app):
    db = app.state.db
    tokens = await create_device_session(db, label="A")
    assert await resolve_session_id_for_access_token(db, tokens["accessToken"]) is not None
    assert await resolve_session_id_for_access_token(db, "bogus") is None
    assert await has_active_device_session(db)


@pytest.mark.asyncio
async def test_revoked_session_invalidates_access(app):
    db = app.state.db
    tokens = await create_device_session(db, label="A")
    await revoke_session(db, tokens["device"]["id"])
    assert await resolve_session_id_for_access_token(db, tokens["accessToken"]) is None
    assert not await has_active_device_session(db)


@pytest.mark.asyncio
async def test_expired_access_token_rejected(app):
    db = app.state.db
    tokens = await create_device_session(db, label="A")
    # Force-expire the access token row.
    past = to_iso_z(__import__("datetime").datetime.now(__import__("datetime").timezone.utc) - timedelta(hours=2))
    await db.execute(
        "UPDATE device_access_tokens SET expires_at = ?",
        (past,),
    )
    assert await resolve_session_id_for_access_token(db, tokens["accessToken"]) is None


@pytest.mark.asyncio
async def test_expired_session_rejects_its_unexpired_access_token(app):
    """Session lifetime bounds every token it issued, even one inside its own TTL."""
    db = app.state.db
    tokens = await create_device_session(db, label="A")
    past = to_iso_z(datetime.now(timezone.utc) - timedelta(days=1))
    await db.execute("UPDATE device_sessions SET expires_at = ?", (past,))
    assert (
        await db.fetch_value("SELECT COUNT(*) FROM device_access_tokens WHERE datetime(expires_at) > datetime('now')")
        == 1
    )
    assert await resolve_session_id_for_access_token(db, tokens["accessToken"]) is None


@pytest.mark.asyncio
async def test_refresh_cas_rejects_stale_token(app):
    db = app.state.db
    tokens = await create_device_session(db, label="A")
    first = await refresh_device_session(db, tokens["refreshToken"])
    assert first is not None
    stale = await refresh_device_session(db, tokens["refreshToken"])
    assert stale is None
    assert await resolve_session_id_for_access_token(db, first["accessToken"]) is not None
    assert await resolve_session_id_for_access_token(db, tokens["accessToken"]) is None


@pytest.mark.asyncio
async def test_refresh_rejects_revoked_session(app):
    db = app.state.db
    tokens = await create_device_session(db, label="A")
    await revoke_session(db, tokens["device"]["id"])
    assert await refresh_device_session(db, tokens["refreshToken"]) is None


@pytest.mark.asyncio
async def test_is_bootstrapped_requires_admin_account(app):
    db = app.state.db
    assert await is_bootstrapped(db) is False
    await mark_household_secured(db)
    assert await is_bootstrapped(db) is False
    await create_admin_account(db, username="admin", password="password1")
    assert await is_bootstrapped(db) is True
    assert await has_active_device_session(db) is False


@pytest.mark.asyncio
async def test_issue_tokens_rolls_back_a_session_without_its_access_token(app, monkeypatch):
    """Session row and first access token commit together.

    Writing them as two independent statements left, on a mid-way failure, a
    session that could neither authenticate nor be refreshed.
    """
    from server import device_auth

    db = app.state.db
    real_new_id = device_auth.new_id
    seen = {"count": 0}

    def flaky_new_id() -> str:
        seen["count"] += 1
        if seen["count"] == 2:
            raise RuntimeError("id generation exploded")
        return real_new_id()

    monkeypatch.setattr(device_auth, "new_id", flaky_new_id)

    with pytest.raises(RuntimeError):
        await create_device_session(db, label="A")

    assert await db.fetch_value("SELECT COUNT(*) FROM device_sessions") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM device_access_tokens") == 0


@pytest.mark.asyncio
async def test_access_ttl_constant():
    assert ACCESS_TTL == timedelta(hours=1)
    assert utc_now_iso()

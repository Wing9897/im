"""Calendar-share session: encrypted tokens, login/logout."""

from __future__ import annotations

from server.calendar_share.constants import KEY_ACCESS_TOKEN, KEY_REFRESH_TOKEN
from server.calendar_share.remote import parse_token_pair
from server.secrets import unprotect_text
from server.tests.calendar_share_fakes import DEFAULT_URL, login_calendar_share


def test_parse_token_pair_accepts_camel_and_snake():
    assert parse_token_pair({"accessToken": "a", "refreshToken": "r"}) == ("a", "r")
    assert parse_token_pair({"access": "a", "refresh": "r"}) == ("a", "r")
    assert parse_token_pair({"access_token": "a", "refresh_token": "r"}) == ("a", "r")
    assert parse_token_pair({"data": {"access": "a", "refresh": "r"}}) == ("a", "r")


async def test_session_login_encrypts_tokens(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    access_raw = await app.state.db.fetch_value(
        "SELECT value FROM system_config WHERE key = ?",
        (KEY_ACCESS_TOKEN,),
    )
    refresh_raw = await app.state.db.fetch_value(
        "SELECT value FROM system_config WHERE key = ?",
        (KEY_REFRESH_TOKEN,),
    )
    assert str(access_raw).startswith("enc:v1:")
    assert str(refresh_raw).startswith("enc:v1:")
    assert unprotect_text(access_raw) == "acc-1"
    assert unprotect_text(refresh_raw) == "ref-1"
    session = (await client.get("/api/v1/calendar-share/session")).json()
    assert "acc-1" not in str(session)
    assert session["status"] == "connected"


async def test_session_login_failure_does_not_store_tokens(client, app, fake_remote):
    fake_remote.login_status = 401
    fake_remote.login_payload = {"message": "bad password"}
    resp = await client.post(
        "/api/v1/calendar-share/session",
        json={"baseUrl": DEFAULT_URL, "handle": "Wing", "password": "nope"},
    )
    assert resp.status_code == 401
    stored = await app.state.db.fetch_value(
        "SELECT value FROM system_config WHERE key = ?",
        (KEY_ACCESS_TOKEN,),
    )
    assert stored in (None, "")


async def test_logout_clears_tokens(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.delete("/api/v1/calendar-share/session")
    assert resp.status_code == 200
    assert resp.json()["connected"] is False
    assert any(call["path"] == "/auth/logout" for call in fake_remote.calls)
    access_raw = await app.state.db.fetch_value(
        "SELECT value FROM system_config WHERE key = ?",
        (KEY_ACCESS_TOKEN,),
    )
    assert unprotect_text(str(access_raw or "")) == ""


async def test_session_get_wipes_legacy_subscription_cache(client, app):
    await app.state.db.execute(
        "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)",
        ("calendar_share_subscriptions", '[{"handle":"Ghost","slug":"Old"}]', "2026-01-01T00:00:00Z"),
    )
    resp = await client.get("/api/v1/calendar-share/session")
    assert resp.status_code == 200
    leftover = await app.state.db.fetch_one(
        "SELECT value FROM system_config WHERE key = ?",
        ("calendar_share_subscriptions",),
    )
    assert leftover is None

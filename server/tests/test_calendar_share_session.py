"""Calendar-share session: encrypted tokens, login/logout."""

from __future__ import annotations

import asyncio

from server.calendar_share.constants import KEY_ACCESS_TOKEN, KEY_REFRESH_TOKEN
from server.calendar_share.remote import _message_from_payload, authorized_request, parse_token_pair
from server.secrets import unprotect_text
from server.tests.calendar_share_fakes import DEFAULT_URL, login_calendar_share


def test_parse_token_pair_accepts_camel_and_snake():
    assert parse_token_pair({"accessToken": "a", "refreshToken": "r"}) == ("a", "r")
    assert parse_token_pair({"access": "a", "refresh": "r"}) == ("a", "r")
    assert parse_token_pair({"access_token": "a", "refresh_token": "r"}) == ("a", "r")
    assert parse_token_pair({"data": {"access": "a", "refresh": "r"}}) == ("a", "r")


def test_message_from_payload_reads_fastapi_validation_list():
    assert _message_from_payload("Duplicate event uid in snapshot", "fallback") == "Duplicate event uid in snapshot"
    assert (
        _message_from_payload(
            {"detail": [{"type": "value_error", "loc": ["body", "events", 0, "start"], "msg": "Field required"}]},
            "fallback",
        )
        == "Field required"
    )
    assert (
        _message_from_payload({"detail": "Event end must be after start"}, "fallback")
        == "Event end must be after start"
    )


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


async def test_concurrent_authorized_requests_refresh_once(app, client, fake_remote, monkeypatch):
    await login_calendar_share(client, fake_remote)
    fake_remote.expired_access_tokens.add("acc-1")
    fake_remote.single_use_refresh = True

    release = asyncio.Event()
    refresh_started = asyncio.Event()
    refresh_calls = 0
    real = fake_remote.__call__

    async def gated(
        *,
        base_url: str,
        method: str,
        path: str,
        json_body=None,
        query=None,
        access_token=None,
        refresh_token=None,
    ):
        nonlocal refresh_calls
        if path == "/auth/refresh":
            refresh_calls += 1
            refresh_started.set()
            await release.wait()
        return await real(
            base_url=base_url,
            method=method,
            path=path,
            json_body=json_body,
            query=query,
            access_token=access_token,
            refresh_token=refresh_token,
        )

    monkeypatch.setattr("server.calendar_share.remote.calendar_share_request", gated)

    async def one():
        return await authorized_request(app.state.db, method="GET", path="/me/subscriptions")

    first = asyncio.create_task(one())
    second = asyncio.create_task(one())
    await refresh_started.wait()
    await asyncio.sleep(0.05)
    release.set()
    results = await asyncio.gather(first, second)
    assert refresh_calls == 1
    assert results[0] == results[1] == {"items": []}

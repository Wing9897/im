"""Calendar-share timezone: local pin + pending public replica."""

from __future__ import annotations

from server.tests.calendar_share_fakes import login_calendar_share


async def test_timezone_save_offline_sets_pending(client, fake_remote):
    resp = await client.put("/api/v1/calendar-share/timezone", json={"timezone": "Asia/Hong_Kong"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["timezone"] == "Asia/Hong_Kong"
    assert body["pendingPublicTimezone"] is True
    assert body["lastPublicTimezone"] == ""
    assert not any(call["path"] == "/me/timezone" for call in fake_remote.calls)

    again = await client.get("/api/v1/calendar-share/timezone")
    assert again.status_code == 200
    assert again.json()["timezone"] == "Asia/Hong_Kong"
    assert again.json()["pendingPublicTimezone"] is True


async def test_timezone_save_connected_clears_pending(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.put("/api/v1/calendar-share/timezone", json={"timezone": "Asia/Taipei"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["timezone"] == "Asia/Taipei"
    assert body["pendingPublicTimezone"] is False
    assert body["lastPublicTimezone"] == "Asia/Taipei"
    tz_calls = [call for call in fake_remote.calls if call["path"] == "/me/timezone"]
    assert tz_calls
    assert tz_calls[-1]["json_body"] == {"timezone": "Asia/Taipei"}


async def test_timezone_save_remote_fail_keeps_pending(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.put_timezone_status = 502
    resp = await client.put("/api/v1/calendar-share/timezone", json={"timezone": "Asia/Tokyo"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["timezone"] == "Asia/Tokyo"
    assert body["pendingPublicTimezone"] is True
    assert body["lastPublicTimezone"] == ""


async def test_login_retries_pending_public_timezone(client, fake_remote):
    first = await client.put("/api/v1/calendar-share/timezone", json={"timezone": "Asia/Singapore"})
    assert first.json()["pendingPublicTimezone"] is True
    await login_calendar_share(client, fake_remote)
    after = await client.get("/api/v1/calendar-share/timezone")
    assert after.status_code == 200
    assert after.json()["pendingPublicTimezone"] is False
    assert after.json()["lastPublicTimezone"] == "Asia/Singapore"
    assert any(call["path"] == "/me/timezone" for call in fake_remote.calls)


async def test_timezone_rejects_floating_sentinel(client):
    resp = await client.put("/api/v1/calendar-share/timezone", json={"timezone": "floating"})
    assert resp.status_code == 422

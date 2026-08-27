"""Calendar-share subscriptions proxy: IC is truth; 502 fails closed."""

from __future__ import annotations

from datetime import UTC, datetime

from server.calendar_share.events import project_subscription_window
from server.tests.calendar_share_fakes import WEEKLY_SERIES, login_calendar_share, subscribe_calendar_share


def _window():
    return datetime(2026, 8, 1, tzinfo=UTC), datetime(2026, 8, 31, tzinfo=UTC)


async def test_subscribe_rejects_own_handle(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.post(
        "/api/v1/calendar-share/subscriptions",
        json={"handle": "Wing", "slug": "Work"},
    )
    assert resp.status_code == 422
    assert not any(call["path"] == "/me/subscriptions" for call in fake_remote.calls)


async def test_subscribe_and_fetch_events(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    await subscribe_calendar_share(client)
    listed = await client.get("/api/v1/calendar-share/subscriptions")
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"] == [{"handle": "Alice", "slug": "Work"}]
    assert listed.json()["ownHandle"] == "Wing"
    events = await client.get(
        "/api/v1/calendar-share/subscriptions/events",
        params={"from": "2026-08-01T00:00:00Z", "to": "2026-08-31T00:00:00Z"},
    )
    assert events.status_code == 200, events.text
    items = events.json()["items"]
    assert len(items) == 1
    assert items[0]["source"] == "subscribed:Alice/Work"
    assert items[0]["id"] == "Alice/Work:evt-1"
    assert items[0]["title"] == "Busy"
    remote_post = next(
        call for call in fake_remote.calls if call["path"] == "/me/subscriptions" and call["method"] == "POST"
    )
    assert remote_post["json_body"] == {"handle": "Alice", "slug": "Work"}


async def test_search_calendars_without_login(client, fake_remote):
    resp = await client.get("/api/v1/calendar-share/search", params={"q": "Demo"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == [{"handle": "DemoPub", "slug": "Open", "visibility": "details"}]
    assert fake_remote.calls[0]["path"] == "/search"
    assert fake_remote.calls[0]["query"] == {"q": "Demo"}
    assert fake_remote.calls[0]["access_token"] is None


async def test_search_calendars_uses_session_when_connected(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.get("/api/v1/calendar-share/search", params={"q": "Open"})
    assert resp.status_code == 200, resp.text
    search_call = next(call for call in fake_remote.calls if call["path"] == "/search")
    assert search_call["query"] == {"q": "Open"}
    assert search_call["access_token"] == "acc-1"


async def test_subscribe_duplicate_is_idempotent(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.post(
        "/api/v1/calendar-share/subscriptions",
        json={"handle": "Alice", "slug": "Work"},
    )
    second = await client.post(
        "/api/v1/calendar-share/subscriptions",
        json={"handle": "Alice", "slug": "Work"},
    )
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert first.json()["items"] == second.json()["items"] == [{"handle": "Alice", "slug": "Work"}]
    remote_posts = [
        call for call in fake_remote.calls if call["path"] == "/me/subscriptions" and call["method"] == "POST"
    ]
    assert len(remote_posts) == 2


async def test_subscribe_unpublished_calendar_is_forbidden(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.post_sub_status = 403
    fake_remote.post_sub_payload = {"detail": "Not allowed to subscribe to this calendar"}
    resp = await client.post(
        "/api/v1/calendar-share/subscriptions",
        json={"handle": "Alice", "slug": "Work"},
    )
    assert resp.status_code == 403
    listed = await client.get("/api/v1/calendar-share/subscriptions")
    assert listed.json()["items"] == []


async def test_disconnected_subscription_events_are_empty(client, fake_remote):
    resp = await client.get(
        "/api/v1/calendar-share/subscriptions/events",
        params={"from": "2026-08-01T00:00:00Z", "to": "2026-08-31T00:00:00Z"},
    )
    assert resp.status_code == 200
    assert resp.json()["items"] == []
    assert fake_remote.calls == []


async def test_list_subscriptions_disconnected_is_empty(client, fake_remote):
    resp = await client.get("/api/v1/calendar-share/subscriptions")
    assert resp.status_code == 200
    assert resp.json()["items"] == []
    assert not any(call["path"] == "/me/subscriptions" for call in fake_remote.calls)


async def test_list_subscriptions_proxies_ic(client, fake_remote):
    fake_remote.remote_subs = [
        {"handle": "DemoPub", "slug": "Open"},
        {"handle": "DemoPub", "slug": "Busy"},
        {"handle": "DemoPub", "slug": "Closed"},
    ]
    await login_calendar_share(client, fake_remote)
    listed = await client.get("/api/v1/calendar-share/subscriptions")
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"] == fake_remote.remote_subs
    assert any(call["path"] == "/me/subscriptions" and call["method"] == "GET" for call in fake_remote.calls)


async def test_list_subscriptions_502_fails_closed(client, app, fake_remote):
    await app.state.db.execute(
        "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)",
        ("calendar_share_subscriptions", '[{"handle":"Ghost","slug":"Old"}]', "2026-01-01T00:00:00Z"),
    )
    await login_calendar_share(client, fake_remote)
    fake_remote.get_sub_status = 502
    listed = await client.get("/api/v1/calendar-share/subscriptions")
    assert listed.status_code == 502
    leftover = await app.state.db.fetch_one(
        "SELECT value FROM system_config WHERE key = ?",
        ("calendar_share_subscriptions",),
    )
    assert leftover is None


async def test_subscribe_get_502_fails_closed(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.get_sub_status = 502
    resp = await client.post(
        "/api/v1/calendar-share/subscriptions",
        json={"handle": "Alice", "slug": "Work"},
    )
    assert resp.status_code == 502
    leftover = await app.state.db.fetch_one(
        "SELECT value FROM system_config WHERE key = ?",
        ("calendar_share_subscriptions",),
    )
    assert leftover is None


async def test_delete_get_502_fails_closed(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await subscribe_calendar_share(client)
    fake_remote.get_sub_status = 502
    deleted = await client.delete(
        "/api/v1/calendar-share/subscriptions",
        params={"handle": "Alice", "slug": "Work"},
    )
    assert deleted.status_code == 502
    leftover = await app.state.db.fetch_one(
        "SELECT value FROM system_config WHERE key = ?",
        ("calendar_share_subscriptions",),
    )
    assert leftover is None


async def test_delete_subscription_hits_remote_unsubscribe(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    await subscribe_calendar_share(client)
    deleted = await client.delete(
        "/api/v1/calendar-share/subscriptions",
        params={"handle": "Alice", "slug": "Work"},
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["items"] == []
    remote_delete = next(
        call for call in fake_remote.calls if call["path"] == "/me/subscriptions" and call["method"] == "DELETE"
    )
    assert remote_delete["query"] == {"handle": "Alice", "slug": "Work"}
    listed = await client.get("/api/v1/calendar-share/subscriptions")
    assert listed.json()["items"] == []


async def test_delete_subscription_requires_login(client, fake_remote):
    resp = await client.delete(
        "/api/v1/calendar-share/subscriptions",
        params={"handle": "Alice", "slug": "Work"},
    )
    assert resp.status_code == 401
    assert not any(call["path"] == "/me/subscriptions" for call in fake_remote.calls)


async def test_subscription_events_empty_when_ic_has_no_subscriptions(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.get(
        "/api/v1/calendar-share/subscriptions/events",
        params={"from": "2026-08-01T00:00:00Z", "to": "2026-08-31T00:00:00Z"},
    )
    assert resp.status_code == 200
    assert resp.json()["items"] == []
    assert any(call["path"] == "/me/subscriptions/events" for call in fake_remote.calls)


async def test_subscription_events_follow_ic_subscriptions(client, fake_remote):
    fake_remote.remote_subs = [
        {"handle": "Alice", "slug": "Work"},
        {"handle": "DemoPub", "slug": "Open"},
    ]
    fake_remote.events_payload = {
        "calendars": [
            {"handle": "Alice", "slug": "Work", "visibility": "busy", "timezone": ""},
            {"handle": "DemoPub", "slug": "Open", "visibility": "details", "timezone": ""},
        ],
        "events": [
            {
                "uid": "evt-1",
                "start": "2026-08-01T09:00:00Z",
                "end": "2026-08-01T10:00:00Z",
                "title": "Busy",
                "handle": "Alice",
                "slug": "Work",
                "allDay": False,
            },
            {
                "uid": "open-008",
                "start": "2026-08-09T17:00:00Z",
                "end": "2026-08-09T18:00:00Z",
                "title": "Open Briefing 008",
                "handle": "DemoPub",
                "slug": "Open",
                "allDay": False,
            },
        ],
        "series": [],
    }
    await login_calendar_share(client, fake_remote)
    listed = await client.get("/api/v1/calendar-share/subscriptions")
    assert listed.json()["items"] == fake_remote.remote_subs
    resp = await client.get(
        "/api/v1/calendar-share/subscriptions/events",
        params={"from": "2026-08-01T00:00:00Z", "to": "2026-08-31T00:00:00Z"},
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert [item["source"] for item in items] == ["subscribed:Alice/Work", "subscribed:DemoPub/Open"]
    assert items[0]["id"] == "Alice/Work:evt-1"
    assert items[1]["id"] == "DemoPub/Open:open-008"


async def test_subscribe_expands_weekly_series(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    await subscribe_calendar_share(client)
    fake_remote.events_payload = {
        "calendars": [{"handle": "Alice", "slug": "Work", "visibility": "details", "timezone": ""}],
        "events": [],
        "series": [WEEKLY_SERIES],
    }
    events = await client.get(
        "/api/v1/calendar-share/subscriptions/events",
        params={"from": "2026-08-01T00:00:00Z", "to": "2026-08-31T00:00:00Z"},
    )
    assert events.status_code == 200, events.text
    items = events.json()["items"]
    assert len(items) >= 4
    ids = [item["id"] for item in items]
    assert len(ids) == len(set(ids))
    assert all(item["source"] == "subscribed:Alice/Work" for item in items)
    assert all(item["title"] == "Standup" for item in items)
    assert all(str(item["id"]).startswith("Alice/Work:series-weekly:") for item in items)
    assert all(item["seriesId"] == "series-weekly" for item in items)
    starts = {item["startTime"] for item in items}
    assert "2026-08-03T09:00:00Z" in starts
    assert "2026-08-10T09:00:00Z" in starts


async def test_subscribe_expands_floating_series_from_calendar_timezone(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    await subscribe_calendar_share(client)
    floating = {**WEEKLY_SERIES, "timezone": ""}
    fake_remote.events_payload = {
        "calendars": [{"handle": "Alice", "slug": "Work", "visibility": "details", "timezone": "UTC"}],
        "events": [],
        "series": [floating],
    }
    events = await client.get(
        "/api/v1/calendar-share/subscriptions/events",
        params={"from": "2026-08-01T00:00:00Z", "to": "2026-08-31T00:00:00Z"},
    )
    assert events.status_code == 200, events.text
    items = events.json()["items"]
    assert len(items) >= 4
    assert all(item["source"] == "subscribed:Alice/Work" for item in items)


async def test_subscribe_busy_series_expands_with_busy_title(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    await subscribe_calendar_share(client)
    fake_remote.events_payload = {
        "calendars": [{"handle": "Alice", "slug": "Work", "visibility": "busy", "timezone": ""}],
        "events": [],
        "series": [{**WEEKLY_SERIES, "name": "忙碌", "location": "", "description": ""}],
    }
    events = await client.get(
        "/api/v1/calendar-share/subscriptions/events",
        params={"from": "2026-08-01T00:00:00Z", "to": "2026-08-31T00:00:00Z"},
    )
    assert events.status_code == 200, events.text
    items = events.json()["items"]
    assert len(items) >= 4
    assert all(item["title"] == "忙碌" for item in items)
    assert all(not item.get("location") for item in items)
    assert all(not item.get("body") for item in items)


def test_project_ic_payload_dedupes_events():
    event = {
        "uid": "evt-1",
        "start": "2026-08-15T09:00:00Z",
        "end": "2026-08-15T10:00:00Z",
        "title": "Once",
        "allDay": False,
        "handle": "Alice",
        "slug": "Work",
    }
    payload = {
        "calendars": [{"handle": "Alice", "slug": "Work", "timezone": "UTC"}],
        "events": [event, event],
        "series": [WEEKLY_SERIES],
    }
    items = project_subscription_window(payload, *_window())
    ids = [item["id"] for item in items]
    assert len(ids) == len(set(ids))
    one_offs = [item for item in items if not item.get("seriesId")]
    assert [item["id"] for item in one_offs] == ["Alice/Work:evt-1"]
    series_rows = [item for item in items if item.get("seriesId") == "series-weekly"]
    assert len(series_rows) >= 4
    assert all(item["source"] == "subscribed:Alice/Work" for item in items)


def test_project_rejects_legacy_aliases_and_bare_lists():
    start, end = _window()
    assert project_subscription_window(
        [
            {
                "uid": "evt-1",
                "start": "2026-08-15T09:00:00Z",
                "handle": "Alice",
                "slug": "Work",
            }
        ],
        start,
        end,
    ) == []
    nested_only = {
        "calendars": [
            {
                "handle": "Alice",
                "slug": "Work",
                "events": [
                    {
                        "uid": "evt-1",
                        "start": "2026-08-15T09:00:00Z",
                        "end": "2026-08-15T10:00:00Z",
                        "title": "Once",
                    }
                ],
                "series": [{k: v for k, v in WEEKLY_SERIES.items() if k not in {"handle", "slug"}}],
            }
        ],
        "events": [
            {
                "uid": "evt-1",
                "startTime": "2026-08-15T09:00:00Z",
                "handle": "Alice",
                "slug": "Work",
            }
        ],
        "series": [],
    }
    assert project_subscription_window(nested_only, start, end) == []
    public_feed = {
        "handle": "Alice",
        "slug": "Work",
        "events": [
            {
                "uid": "evt-1",
                "start": "2026-08-15T09:00:00Z",
                "end": "2026-08-15T10:00:00Z",
                "title": "Once",
            }
        ],
        "series": [{k: v for k, v in WEEKLY_SERIES.items() if k not in {"handle", "slug"}}],
    }
    assert project_subscription_window(public_feed, start, end) == []

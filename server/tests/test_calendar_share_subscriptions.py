"""Calendar-share subscriptions proxy CRUD: search, list, subscribe, unsubscribe."""

from __future__ import annotations

from server.tests.calendar_share_fakes import login_calendar_share, subscribe_calendar_share


async def test_subscribe_rejects_own_handle(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.post(
        "/api/v1/calendar-share/subscriptions",
        json={"handle": "Wing", "slug": "Work"},
    )
    assert resp.status_code == 422
    assert not any(call["path"] == "/me/subscriptions" for call in fake_remote.calls)


async def test_search_calendars_without_login(client, fake_remote):
    resp = await client.get("/api/v1/calendar-share/search", params={"q": "Demo"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == [
        {
            "handle": "DemoPub",
            "slug": "Open",
            "hitKind": "listing",
            "publicVisibility": "public",
            "visibility": None,
            "description": "",
            "ownerAvatar": "",
            "cover": "",
        }
    ]
    assert fake_remote.calls[0]["path"] == "/search"
    assert fake_remote.calls[0]["query"] == {"q": "Demo"}
    assert fake_remote.calls[0]["access_token"] is None


async def test_search_keeps_listing_and_grant_visibility_distinct(client, fake_remote):
    fake_remote.search_payload = {
        "items": [
            {
                "handle": "DemoPub",
                "slug": "Open",
                "hitKind": "listing",
                "publicVisibility": "public",
                "description": "Open cal",
            },
            {
                "handle": "DemoPub",
                "slug": "Busy",
                "hitKind": "listing",
                "publicVisibility": "public_busy",
                "description": "",
            },
            {
                "handle": "DemoPub",
                "slug": "Closed",
                "hitKind": "grant",
                "visibility": "details",
                "description": "Grant",
            },
            {
                "handle": "DemoPub",
                "slug": "ClosedBusy",
                "hitKind": "grant",
                "visibility": "busy",
                "description": "",
            },
            {"handle": "Skip", "slug": "Old", "publicVisibility": "private_group"},
        ]
    }
    resp = await client.get("/api/v1/calendar-share/search", params={"q": "Demo"})
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    by_slug = {row["slug"]: row for row in items}
    assert by_slug["Open"]["publicVisibility"] == "public"
    assert by_slug["Open"]["hitKind"] == "listing"
    assert by_slug["Open"]["description"] == "Open cal"
    assert by_slug["Busy"]["publicVisibility"] == "public_busy"
    assert by_slug["Closed"]["visibility"] == "details"
    assert by_slug["Closed"]["hitKind"] == "grant"
    assert by_slug["ClosedBusy"]["visibility"] == "busy"
    assert "Old" not in by_slug


async def test_search_calendars_uses_session_when_connected(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.get("/api/v1/calendar-share/search", params={"q": "Open"})
    assert resp.status_code == 200, resp.text
    search_call = next(call for call in fake_remote.calls if call["path"] == "/search")
    assert search_call["query"] == {"q": "Open"}
    assert search_call["access_token"] == "acc-1"


async def test_search_calendars_maps_remote_404_to_empty(client, fake_remote):
    fake_remote.search_status = 404
    fake_remote.search_payload = {"message": "Not found"}
    resp = await client.get("/api/v1/calendar-share/search")
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == []
    assert "not found" not in resp.text.lower()


async def test_search_calendars_maps_logged_in_404_to_empty(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.search_status = 404
    fake_remote.search_payload = {"message": "Not found"}
    resp = await client.get("/api/v1/calendar-share/search", params={"q": "Open"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == []
    assert "not found" not in resp.text.lower()


async def test_search_empty_q_excludes_grants_even_when_signed_in(client, fake_remote):
    """Mirror IC test_search: empty q lists public calendars only, never grant hits."""
    fake_remote.search_by_query = {
        "": {
            "items": [
                {
                    "handle": "DemoPub",
                    "slug": "Open",
                    "hitKind": "listing",
                    "publicVisibility": "public",
                    "description": "",
                },
            ],
        },
    }
    await login_calendar_share(client, fake_remote)
    for params in (None, {"q": ""}):
        fake_remote.calls.clear()
        resp = await client.get("/api/v1/calendar-share/search", params=params)
        assert resp.status_code == 200, resp.text
        items = resp.json()["items"]
        demo_slugs = {row["slug"] for row in items if row["handle"] == "DemoPub"}
        assert demo_slugs == {"Open"}
        assert all(row.get("hitKind") != "grant" for row in items)
        search_call = next(call for call in fake_remote.calls if call["path"] == "/search")
        assert search_call["query"] == {"q": ""}
        assert search_call["access_token"] == "acc-1"


async def test_search_grant_requires_exact_match_not_like(client, fake_remote):
    """Mirror IC test_search: grant hits require exact slug or handle/slug path, not LIKE partials."""
    grant_hit = {
        "handle": "DemoPub",
        "slug": "Closed",
        "hitKind": "grant",
        "visibility": "busy",
        "description": "",
        "ownerAvatar": "",
        "cover": "",
    }
    fake_remote.search_by_query = {
        "Clos": {"items": []},
        "Closed": {"items": [grant_hit]},
        "DemoPub/Closed": {"items": [grant_hit]},
    }
    await login_calendar_share(client, fake_remote)

    partial = await client.get("/api/v1/calendar-share/search", params={"q": "Clos"})
    assert partial.status_code == 200, partial.text
    assert partial.json()["items"] == []

    exact_slug = await client.get("/api/v1/calendar-share/search", params={"q": "Closed"})
    assert exact_slug.status_code == 200, exact_slug.text
    row = exact_slug.json()["items"][0]
    assert row["handle"] == "DemoPub"
    assert row["slug"] == "Closed"
    assert row["hitKind"] == "grant"
    assert row["visibility"] == "busy"
    assert row["publicVisibility"] is None

    exact_path = await client.get("/api/v1/calendar-share/search", params={"q": "DemoPub/Closed"})
    assert exact_path.status_code == 200, exact_path.text
    assert len(exact_path.json()["items"]) == 1
    assert exact_path.json()["items"][0]["slug"] == "Closed"
    assert exact_path.json()["items"][0]["hitKind"] == "grant"


async def test_search_forwards_owner_avatar_and_cover(client, fake_remote):
    fake_remote.search_payload = {
        "items": [
            {
                "handle": "DemoPub",
                "slug": "Open",
                "hitKind": "listing",
                "publicVisibility": "public",
                "description": "Open cal",
                "ownerAvatar": "data:image/png;base64,abc",
                "cover": "data:image/jpeg;base64,cover",
            },
        ]
    }
    resp = await client.get("/api/v1/calendar-share/search", params={"q": "Demo"})
    assert resp.status_code == 200, resp.text
    row = resp.json()["items"][0]
    assert row["ownerAvatar"] == "data:image/png;base64,abc"
    assert row["cover"] == "data:image/jpeg;base64,cover"


async def test_put_profile_syncs_avatar_to_ic(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    avatar = "data:image/png;base64,avatar"
    resp = await client.put("/api/v1/calendar-share/profile", json={"avatar": avatar})
    assert resp.status_code == 200, resp.text
    assert resp.json()["avatar"] == avatar
    put_call = next(call for call in fake_remote.calls if call["path"] == "/me" and call["method"] == "PUT")
    assert put_call["json_body"] == {"avatar": avatar}


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
    assert (
        first.json()["items"]
        == second.json()["items"]
        == [{"handle": "Alice", "slug": "Work", "description": "", "ownerAvatar": "", "cover": ""}]
    )
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
    assert listed.json()["items"] == [
        {
            **row,
            "description": row.get("description", ""),
            "ownerAvatar": row.get("ownerAvatar", ""),
            "cover": row.get("cover", ""),
        }
        for row in fake_remote.remote_subs
    ]
    assert any(call["path"] == "/me/subscriptions" and call["method"] == "GET" for call in fake_remote.calls)


async def test_list_subscriptions_502_fails_closed(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.get_sub_status = 502
    listed = await client.get("/api/v1/calendar-share/subscriptions")
    assert listed.status_code == 502


async def test_list_subscriptions_remote_404_is_empty(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.get_sub_status = 404
    listed = await client.get("/api/v1/calendar-share/subscriptions")
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"] == []


async def test_subscribe_get_502_fails_closed(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.get_sub_status = 502
    resp = await client.post(
        "/api/v1/calendar-share/subscriptions",
        json={"handle": "Alice", "slug": "Work"},
    )
    assert resp.status_code == 502


async def test_delete_get_502_fails_closed(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    await subscribe_calendar_share(client)
    fake_remote.get_sub_status = 502
    deleted = await client.delete(
        "/api/v1/calendar-share/subscriptions",
        params={"handle": "Alice", "slug": "Work"},
    )
    assert deleted.status_code == 502


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

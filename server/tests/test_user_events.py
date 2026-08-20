"""API + service tests for user_events CRUD."""

from __future__ import annotations

from server.calendar.user_events_read import list_user_events
from server.calendar.user_events_write import create_user_event
from server.queries.calendar_queries import fetch_user_event

USER_EVENT_KEYS = {
    "id",
    "title",
    "body",
    "startTime",
    "endTime",
    "location",
    "origin",
    "isAllDay",
    "timezone",
    "icsUid",
    "icsSource",
    "remindBeforeDays",
    "taskId",
    "itemId",
    "worksetId",
    "kind",
    "amount",
    "direction",
    "notifyPref",
    "emoji",
    "source",
    "dismissed",
    "important",
    "createdAt",
    "updatedAt",
}


async def test_user_events_crud_roundtrip(client) -> None:
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "手動會議",
            "startTime": "2026-07-21T09:00:00Z",
            "endTime": "2026-07-21T10:00:00Z",
            "body": "討論事項",
            "location": "台北",
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert set(body) == USER_EVENT_KEYS
    assert body["title"] == "手動會議"
    assert body["source"] == "user"
    assert body["origin"] == "manual"
    assert body["taskId"] == ""
    assert body["startTime"] == "2026-07-21T09:00:00Z"
    assert body["endTime"] == "2026-07-21T10:00:00Z"
    assert isinstance(body["id"], str) and body["id"]
    assert isinstance(body["body"], str)
    assert isinstance(body["createdAt"], str)
    assert isinstance(body["updatedAt"], str)
    event_id = body["id"]

    listed = await client.get(
        "/api/v1/calendar/user-events",
        params={"startTime": "2026-07-21T00:00:00Z", "endTime": "2026-07-22T00:00:00Z"},
    )
    assert listed.status_code == 200
    assert any(item["id"] == event_id for item in listed.json()["items"])

    patched = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"title": "手動會議（改）", "endTime": None},
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "手動會議（改）"
    assert patched.json()["endTime"] is None

    deleted = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
    assert deleted.status_code == 204

    listed = await client.get("/api/v1/calendar/user-events")
    assert all(item["id"] != event_id for item in listed.json()["items"])
    missing = await client.get(f"/api/v1/calendar/user-events/{event_id}")
    assert missing.status_code == 404
    again = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
    assert again.status_code == 404


async def test_user_event_delete_removes_agent_origin_row(client, app) -> None:
    event = await create_user_event(
        app.state.db,
        title="Agent origin",
        start_time="2026-07-21T11:00:00Z",
        origin="agent",
    )
    event_id = event["id"]
    deleted = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
    assert deleted.status_code == 204
    assert await fetch_user_event(app.state.db, event_id) is None


async def test_user_events_normalize_offset_to_utc_z(client) -> None:
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "台北下午三點",
            "startTime": "2026-07-22T15:00:00+08:00",
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["startTime"] == "2026-07-22T07:00:00Z"
    await client.delete(f"/api/v1/calendar/user-events/{body['id']}")

    bad = await client.post(
        "/api/v1/calendar/user-events",
        json={"title": "  ", "startTime": "2026-07-21T09:00:00Z"},
    )
    assert bad.status_code == 422

    bad_time = await client.post(
        "/api/v1/calendar/user-events",
        json={"title": "x", "startTime": "not-a-time"},
    )
    assert bad_time.status_code == 422


async def test_rest_create_rejects_forged_origin(client) -> None:
    response = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "偽造來源",
            "startTime": "2026-07-21T09:00:00Z",
            "origin": "assistant",
        },
    )
    assert response.status_code == 422


async def test_user_events_list_preserves_a2a_origin(client, app) -> None:
    event = await create_user_event(
        app.state.db,
        title="A2A list origin",
        start_time="2026-07-28T09:00:00Z",
        origin="a2a",
    )
    response = await client.get("/api/v1/calendar/user-events")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"items", "totalCount", "hasMore"}
    listed = next(item for item in body["items"] if item["id"] == event["id"])
    assert listed["origin"] == "a2a"
    assert set(listed) == USER_EVENT_KEYS


async def test_user_events_all_day_roundtrip(client) -> None:
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "全日休假",
            "startTime": "2026-08-01T00:00:00Z",
            "endTime": "2026-08-04T00:00:00Z",
            "isAllDay": True,
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["isAllDay"] is True
    assert body["startTime"] == "2026-08-01T00:00:00Z"
    assert body["endTime"] == "2026-08-04T00:00:00Z"

    patched = await client.patch(
        f"/api/v1/calendar/user-events/{body['id']}",
        json={"isAllDay": False},
    )
    assert patched.status_code == 200
    assert patched.json()["isAllDay"] is False

    await client.delete(f"/api/v1/calendar/user-events/{body['id']}")


async def test_list_user_events_uses_overlap_window(app) -> None:
    db = app.state.db
    spanning = await create_user_event(
        db,
        title="跨窗事件",
        start_time="2026-07-21T09:00:00Z",
        end_time="2026-07-21T12:00:00Z",
    )
    at_start = await create_user_event(
        db,
        title="起點邊界",
        start_time="2026-07-21T08:00:00Z",
        end_time="2026-07-21T10:00:00Z",
    )
    at_end = await create_user_event(
        db,
        title="終點邊界",
        start_time="2026-07-21T11:00:00Z",
    )
    await create_user_event(
        db,
        title="窗口之前",
        start_time="2026-07-21T08:00:00Z",
        end_time="2026-07-21T09:59:59Z",
    )
    await create_user_event(
        db,
        title="窗口之後",
        start_time="2026-07-21T11:00:01Z",
    )

    listed = await list_user_events(
        db,
        start="2026-07-21T10:00:00Z",
        end="2026-07-21T11:00:00Z",
    )

    ids = {item["id"] for item in listed}
    assert ids == {spanning["id"], at_start["id"], at_end["id"]}


async def test_list_user_events_filters_by_task_id(client, app) -> None:
    from server.tests import seed

    owned = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "所屬事件",
            "startTime": "2026-07-21T09:00:00Z",
            "taskId": seed.TASK_EVENT,
        },
    )
    assert owned.status_code == 201
    other = await client.post(
        "/api/v1/calendar/user-events",
        json={"title": "未掛任務", "startTime": "2026-07-21T10:00:00Z"},
    )
    assert other.status_code == 201

    listed = await client.get("/api/v1/calendar/user-events", params={"taskId": seed.TASK_EVENT})
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()["items"]}
    assert ids == {owned.json()["id"]}

    # task_id=__general__ is rejected; ownership filter uses workset_id.
    rejected = await client.get("/api/v1/calendar/user-events", params={"taskId": "__general__"})
    assert rejected.status_code == 400

    system_ws = await client.get("/api/v1/calendar/user-events", params={"worksetId": "__general__"})
    assert system_ws.status_code == 200
    system_ids = {item["id"] for item in system_ws.json()["items"]}
    assert other.json()["id"] in system_ids
    # Owned event may still be on __general__ workset if task had no workset — check provenance filter.
    null_provenance = await client.get("/api/v1/calendar/user-events", params={"taskId": ""})
    assert null_provenance.status_code == 200
    null_ids = {item["id"] for item in null_provenance.json()["items"]}
    assert other.json()["id"] in null_ids
    assert owned.json()["id"] not in null_ids


async def test_user_events_task_id_bind_and_reject(client, app) -> None:
    from server.tests import seed

    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "掛到事件任務",
            "startTime": "2026-07-21T09:00:00Z",
            "taskId": seed.TASK_EVENT,
        },
    )
    assert created.status_code == 201
    assert created.json()["taskId"] == seed.TASK_EVENT

    # Empty string clears task provenance (optional); ownership is via worksetId.
    cleared = await client.patch(
        f"/api/v1/calendar/user-events/{created.json()['id']}",
        json={"taskId": ""},
    )
    assert cleared.status_code == 200
    assert cleared.json()["taskId"] == ""

    # Reject sentinel as taskId — ownership is worksetId only.
    rejected = await client.patch(
        f"/api/v1/calendar/user-events/{created.json()['id']}",
        json={"taskId": "__general__"},
    )
    assert rejected.status_code == 400

    # Can attach to an event task.
    attached = await client.patch(
        f"/api/v1/calendar/user-events/{created.json()['id']}",
        json={"taskId": seed.TASK_EVENT},
    )
    assert attached.status_code == 200
    assert attached.json()["taskId"] == seed.TASK_EVENT

    # leaderboard is rejected.
    bad_mode = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "非法模式",
            "startTime": "2026-07-21T09:00:00Z",
            "taskId": seed.TASK_LEADERBOARD,
        },
    )
    assert bad_mode.status_code == 400

    missing = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "不存在任務",
            "startTime": "2026-07-21T09:00:00Z",
            "taskId": "no-such-task",
        },
    )
    assert missing.status_code == 400


async def test_user_events_amount_and_direction_roundtrip(client) -> None:
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Purchased",
            "kind": "purchase_effective",
            "startTime": "2026-08-05T10:00:00Z",
            "endTime": "2026-08-05T11:00:00Z",
            "amount": 1280.5,
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["kind"] == "purchase_effective"
    assert body["amount"] == 1280.5
    assert body["direction"] == "expense"

    event_id = body["id"]
    patched = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"direction": "income", "amount": 99},
    )
    assert patched.status_code == 200
    assert patched.json()["amount"] == 99
    assert patched.json()["direction"] == "income"

    cleared = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"amount": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["amount"] is None
    assert cleared.json()["direction"] is None

    bad = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Purchased",
            "kind": "purchase_effective",
            "startTime": "2026-08-05T10:00:00Z",
            "amount": -1,
        },
    )
    assert bad.status_code == 422

    stripped = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Purchased",
            "kind": "normal",
            "startTime": "2026-08-05T10:00:00Z",
            "amount": 50,
        },
    )
    assert stripped.status_code == 201
    assert stripped.json()["kind"] == "normal"
    assert stripped.json()["amount"] is None
    assert stripped.json()["direction"] is None

    title_only = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Purchased",
            "startTime": "2026-08-05T10:00:00Z",
            "amount": 10,
        },
    )
    assert title_only.status_code == 201
    assert title_only.json()["kind"] == "normal"
    assert title_only.json()["amount"] is None


async def test_list_user_events_search_and_pagination(client) -> None:
    created = []
    for idx, title in enumerate(["晨會 Alpha", "午餐 Beta", "晚間 Alpha 複盤"]):
        response = await client.post(
            "/api/v1/calendar/user-events",
            json={
                "title": title,
                "body": f"body-{idx}",
                "location": "台北" if idx == 0 else "高雄",
                "startTime": f"2026-09-0{idx + 1}T09:00:00Z",
            },
        )
        assert response.status_code == 201
        created.append(response.json())

    by_title = await client.get("/api/v1/calendar/user-events", params={"search": "Alpha"})
    assert by_title.status_code == 200
    page = by_title.json()
    assert page["totalCount"] == 2
    assert page["hasMore"] is False
    assert {item["id"] for item in page["items"]} == {created[0]["id"], created[2]["id"]}

    by_location = await client.get("/api/v1/calendar/user-events", params={"search": "高雄"})
    assert by_location.status_code == 200
    assert {item["id"] for item in by_location.json()["items"]} == {created[1]["id"], created[2]["id"]}

    first = await client.get(
        "/api/v1/calendar/user-events",
        params={"search": "Alpha", "limit": 1, "offset": 0},
    )
    assert first.status_code == 200
    first_page = first.json()
    assert first_page["totalCount"] == 2
    assert first_page["hasMore"] is True
    assert len(first_page["items"]) == 1

    second = await client.get(
        "/api/v1/calendar/user-events",
        params={"search": "Alpha", "limit": 1, "offset": 1},
    )
    assert second.status_code == 200
    second_page = second.json()
    assert second_page["totalCount"] == 2
    assert second_page["hasMore"] is False
    assert len(second_page["items"]) == 1
    assert first_page["items"][0]["id"] != second_page["items"][0]["id"]
    assert {first_page["items"][0]["id"], second_page["items"][0]["id"]} == {
        created[0]["id"],
        created[2]["id"],
    }

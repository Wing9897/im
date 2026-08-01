"""API + service tests for user_events CRUD."""

from __future__ import annotations

from server.calendar.user_events import create_user_event, list_user_events

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
    "taskId",
    "worksetId",
    "source",
    "dismissed",
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
        params={"start": "2026-07-21T00:00:00Z", "end": "2026-07-22T00:00:00Z"},
    )
    assert listed.status_code == 200
    assert any(item["id"] == event_id for item in listed.json())

    patched = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"title": "手動會議（改）", "endTime": None},
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "手動會議（改）"
    assert patched.json()["endTime"] is None

    deleted = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
    assert deleted.status_code == 204

    soft = await client.get("/api/v1/calendar/user-events")
    match = next(item for item in soft.json() if item["id"] == event_id)
    assert match["dismissed"] is True


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

    listed = await client.get("/api/v1/calendar/user-events", params={"task_id": seed.TASK_EVENT})
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()}
    assert ids == {owned.json()["id"]}

    # task_id=__user__ is rejected; ownership filter uses workset_id.
    rejected = await client.get("/api/v1/calendar/user-events", params={"task_id": "__user__"})
    assert rejected.status_code == 400

    system_ws = await client.get("/api/v1/calendar/user-events", params={"workset_id": "__user__"})
    assert system_ws.status_code == 200
    system_ids = {item["id"] for item in system_ws.json()}
    assert other.json()["id"] in system_ids
    # Owned event may still be on __user__ workset if task had no workset — check provenance filter.
    null_provenance = await client.get("/api/v1/calendar/user-events", params={"task_id": ""})
    assert null_provenance.status_code == 200
    null_ids = {item["id"] for item in null_provenance.json()}
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
        json={"taskId": "__user__"},
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

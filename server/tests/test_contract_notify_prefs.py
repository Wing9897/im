"""Contract tests for workset notifyEnabled + per-row notifyPref (inherit / off)."""

from __future__ import annotations

from server.tests.contract_helpers import assert_keys

WORKSET_KEYS = ["id", "name", "isSystem", "notifyEnabled", "externalEnabled", "createdAt", "updatedAt"]
USER_EVENT_NOTIFY_KEYS = ["id", "title", "notifyPref", "worksetId"]
RECURRING_NOTIFY_KEYS = ["id", "name", "rrule", "notifyPref", "worksetId"]
TASK_NOTIFY_KEYS = ["id", "name", "notifyPref"]


async def test_builtin_workset_notify_enabled_defaults_on(client):
    listed = await client.get("/api/v1/worksets")
    assert listed.status_code == 200
    builtin = next(row for row in listed.json() if row["id"] == "__general__")
    assert_keys(builtin, WORKSET_KEYS, "builtin WorksetResponse")
    assert builtin["notifyEnabled"] is True
    assert builtin["externalEnabled"] is True
    assert builtin["name"] == "一般"


async def test_workset_create_and_patch_notify_enabled(client):
    created = await client.post("/api/v1/worksets", json={"name": "Quiet"})
    assert created.status_code == 201
    body = created.json()
    assert_keys(body, WORKSET_KEYS, "WorksetResponse")
    assert body["notifyEnabled"] is True
    assert body["externalEnabled"] is True

    off = await client.post("/api/v1/worksets", json={"name": "Muted", "notifyEnabled": False})
    assert off.status_code == 201
    assert off.json()["notifyEnabled"] is False
    muted_id = off.json()["id"]

    patched = await client.put(f"/api/v1/worksets/{muted_id}", json={"notifyEnabled": True})
    assert patched.status_code == 200
    assert patched.json()["notifyEnabled"] is True
    assert patched.json()["name"] == "Muted"


async def test_system_workset_can_toggle_notify_but_not_rename(client):
    renamed = await client.put("/api/v1/worksets/__general__", json={"name": "Hacked"})
    assert renamed.status_code == 403

    toggled = await client.put("/api/v1/worksets/__general__", json={"notifyEnabled": False})
    assert toggled.status_code == 200
    assert toggled.json()["notifyEnabled"] is False
    assert toggled.json()["name"] == "一般"

    restored = await client.put("/api/v1/worksets/__general__", json={"notifyEnabled": True})
    assert restored.status_code == 200
    assert restored.json()["notifyEnabled"] is True


async def test_workset_create_and_patch_external_enabled(client):
    created = await client.post("/api/v1/worksets", json={"name": "Private", "externalEnabled": False})
    assert created.status_code == 201
    body = created.json()
    assert_keys(body, WORKSET_KEYS, "WorksetResponse")
    assert body["externalEnabled"] is False
    assert body["notifyEnabled"] is True
    workset_id = body["id"]

    patched = await client.put(f"/api/v1/worksets/{workset_id}", json={"externalEnabled": True})
    assert patched.status_code == 200
    assert patched.json()["externalEnabled"] is True
    assert patched.json()["name"] == "Private"


async def test_system_workset_can_toggle_external(client):
    toggled = await client.put("/api/v1/worksets/__general__", json={"externalEnabled": False})
    assert toggled.status_code == 200
    assert toggled.json()["externalEnabled"] is False
    assert toggled.json()["name"] == "一般"
    assert toggled.json()["notifyEnabled"] is True

    restored = await client.put("/api/v1/worksets/__general__", json={"externalEnabled": True})
    assert restored.status_code == 200
    assert restored.json()["externalEnabled"] is True


async def test_user_event_notify_pref_default_and_override(client):
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={"title": "Default off", "startTime": "2026-08-14T09:00:00Z"},
    )
    assert created.status_code == 201
    body = created.json()
    assert set(body) >= set(USER_EVENT_NOTIFY_KEYS)
    assert body["notifyPref"] == "off"

    muted = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Muted row",
            "startTime": "2026-08-14T10:00:00Z",
            "notifyPref": "off",
        },
    )
    assert muted.status_code == 201
    assert muted.json()["notifyPref"] == "off"
    event_id = muted.json()["id"]

    patched = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"notifyPref": "inherit"},
    )
    assert patched.status_code == 200
    assert patched.json()["notifyPref"] == "inherit"

    rejected_on = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Legacy on rejected",
            "startTime": "2026-08-14T10:30:00Z",
            "notifyPref": "on",
        },
    )
    assert rejected_on.status_code == 422

    rejected_follow = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Legacy follow rejected",
            "startTime": "2026-08-14T10:35:00Z",
            "notifyPref": "follow",
        },
    )
    assert rejected_follow.status_code == 422

    deleted = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
    assert deleted.status_code == 204

    invalid = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Bad pref",
            "startTime": "2026-08-14T11:00:00Z",
            "notifyPref": "maybe",
        },
    )
    assert invalid.status_code == 422


async def test_recurring_series_notify_pref_without_remind_before_days(client):
    created = await client.post(
        "/api/v1/calendar/recurring",
        json={"name": "Weekly", "rrule": "FREQ=WEEKLY;BYDAY=MO", "eventStartTime": "09:00"},
    )
    assert created.status_code == 201
    body = created.json()
    assert_keys(body, RECURRING_NOTIFY_KEYS, "RecurringSeriesResponse")
    assert body["notifyPref"] == "off"
    assert "remindBeforeDays" not in body
    series_id = body["id"]

    patched = await client.patch(
        f"/api/v1/calendar/recurring/{series_id}",
        json={"notifyPref": "off"},
    )
    assert patched.status_code == 200
    assert patched.json()["notifyPref"] == "off"

    rejected_on = await client.post(
        "/api/v1/calendar/recurring",
        json={
            "name": "Forced",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "08:00",
            "notifyPref": "on",
        },
    )
    assert rejected_on.status_code == 422
    rejected_follow = await client.post(
        "/api/v1/calendar/recurring",
        json={
            "name": "Forced follow",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "08:00",
            "notifyPref": "follow",
        },
    )
    assert rejected_follow.status_code == 422
    deleted = await client.delete(f"/api/v1/calendar/recurring/{series_id}")
    assert deleted.status_code == 204


async def test_analysis_task_notify_pref_default_and_update(client):
    created = await client.post(
        "/api/v1/tasks",
        json={"name": "Notify task", "analysisMode": "intel_event", "promptTemplate": "x"},
    )
    assert created.status_code == 201
    body = created.json()
    assert_keys(body, TASK_NOTIFY_KEYS, "TaskResponse notifyPref")
    assert body["notifyPref"] == "inherit"
    task_id = body["id"]

    updated = await client.put(
        f"/api/v1/tasks/{task_id}",
        json={
            "name": "Notify task",
            "analysisMode": "intel_event",
            "promptTemplate": "x",
            "notifyPref": "off",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["notifyPref"] == "off"


async def test_item_remind_projection_inherits_expires_notify_pref(client):
    from datetime import date, timedelta

    today = date.today()
    expires = (today + timedelta(days=10)).isoformat()
    created = await client.post("/api/v1/items", json={"title": "Passport", "status": "active"})
    assert created.status_code == 201
    item_id = created.json()["id"]
    linked = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "kind": "expires",
            "startTime": f"{expires}T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 3,
            "notifyPref": "off",
        },
    )
    assert linked.status_code == 201
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=40)).isoformat()
    api = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": f"{start}T00:00:00Z",
            "rangeEnd": f"{end}T23:59:59Z",
        },
    )
    assert api.status_code == 200
    remind = next(row for row in api.json() if row["id"] == f"item:{item_id}:remind")
    assert remind["notifyPref"] == "off"


async def test_calendar_occurrence_inherits_series_notify_pref(client):
    created = await client.post(
        "/api/v1/calendar/recurring",
        json={
            "name": "Muted series",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "10:00",
            "notifyPref": "off",
        },
    )
    assert created.status_code == 201
    series_id = created.json()["id"]
    items = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": "2026-01-01T00:00:00Z",
            "rangeEnd": "2027-01-01T00:00:00Z",
            "seriesId": series_id,
            "includeItems": "false",
        },
    )
    assert items.status_code == 200
    body = items.json()
    assert body, "expected at least one occurrence in the year window"
    assert all(row["notifyPref"] == "off" for row in body)
    assert all(row["seriesId"] == series_id for row in body)

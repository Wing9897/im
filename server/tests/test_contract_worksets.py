"""Contract tests for /api/v1/worksets and task worksetId wiring."""

from __future__ import annotations

from server.tests.contract_helpers import assert_keys

WORKSET_KEYS = ["id", "name", "isSystem", "createdAt", "updatedAt"]


async def test_worksets_crud_and_task_workset_id(client):
    empty = await client.get("/api/v1/worksets")
    assert empty.status_code == 200
    listed0 = empty.json()
    # Builtin system workset is always present.
    assert len(listed0) == 1
    assert listed0[0]["id"] == "__user__"
    assert listed0[0]["isSystem"] is True
    assert listed0[0]["name"] == "一般"

    created = await client.post("/api/v1/worksets", json={"name": "  Alpha  "})
    assert created.status_code == 201
    body = created.json()
    assert_keys(body, WORKSET_KEYS, "WorksetResponse")
    assert body["name"] == "Alpha"
    assert body["isSystem"] is False
    workset_id = body["id"]

    listed = await client.get("/api/v1/worksets")
    assert listed.status_code == 200
    assert len(listed.json()) == 2
    assert any(row["id"] == workset_id for row in listed.json())

    renamed = await client.put(f"/api/v1/worksets/{workset_id}", json={"name": "Beta"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Beta"

    fetched = await client.get(f"/api/v1/worksets/{workset_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Beta"

    blank = await client.post("/api/v1/worksets", json={"name": "   "})
    assert blank.status_code == 422

    missing = await client.get("/api/v1/worksets/does-not-exist")
    assert missing.status_code == 404

    task = await client.post(
        "/api/v1/tasks",
        json={
            "name": "Owned event",
            "analysisMode": "event",
            "promptTemplate": "x",
            "worksetId": workset_id,
        },
    )
    assert task.status_code == 201
    task_body = task.json()
    assert task_body["worksetId"] == workset_id

    filtered = await client.get(f"/api/v1/tasks?workset_id={workset_id}")
    assert filtered.status_code == 200
    assert any(row["id"] == task_body["id"] for row in filtered.json())

    cleared = await client.put(
        f"/api/v1/tasks/{task_body['id']}",
        json={
            "name": "Owned event",
            "analysisMode": "event",
            "promptTemplate": "x",
            "worksetId": None,
        },
    )
    assert cleared.status_code == 200
    assert cleared.json()["worksetId"] is None

    # Re-attach then delete workset → task worksetId SET NULL; events → __user__
    await client.put(
        f"/api/v1/tasks/{task_body['id']}",
        json={
            "name": "Owned event",
            "analysisMode": "event",
            "promptTemplate": "x",
            "worksetId": workset_id,
        },
    )
    ue = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Owned UE",
            "startTime": "2026-07-03T09:00:00Z",
            "worksetId": workset_id,
        },
    )
    assert ue.status_code == 201
    ue_id = ue.json()["id"]

    deleted = await client.delete(f"/api/v1/worksets/{workset_id}")
    assert deleted.status_code == 200
    assert deleted.json() == {"ok": True}

    # GET single task may 405 — list instead
    tasks = await client.get("/api/v1/tasks")
    owned = next(t for t in tasks.json() if t["id"] == task_body["id"])
    assert owned["worksetId"] is None

    events = await client.get("/api/v1/calendar/user-events", params={"workset_id": "__user__"})
    assert events.status_code == 200
    reassigned = next(e for e in events.json() if e["id"] == ue_id)
    assert reassigned["worksetId"] == "__user__"

    again = await client.delete(f"/api/v1/worksets/{workset_id}")
    assert again.status_code == 404


async def test_system_workset_cannot_be_deleted(client):
    resp = await client.delete("/api/v1/worksets/__user__")
    assert resp.status_code == 403
    assert resp.json()["error_code"] == "FORBIDDEN"
    listed = await client.get("/api/v1/worksets")
    assert any(row["id"] == "__user__" and row["isSystem"] for row in listed.json())


async def test_system_workset_cannot_be_renamed(client):
    resp = await client.put("/api/v1/worksets/__user__", json={"name": "Hacked"})
    assert resp.status_code == 403
    assert resp.json()["error_code"] == "FORBIDDEN"
    listed = await client.get("/api/v1/worksets")
    builtin = next(row for row in listed.json() if row["id"] == "__user__")
    assert builtin["isSystem"] is True
    assert builtin["name"] != "Hacked"


async def test_user_event_create_by_workset(client):
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "By workset",
            "startTime": "2026-07-01T09:00:00Z",
            "worksetId": "__user__",
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["worksetId"] == "__user__"
    assert body["taskId"] == ""

    custom = await client.post("/api/v1/worksets", json={"name": "Desk"})
    wid = custom.json()["id"]
    tagged = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Desk event",
            "startTime": "2026-07-02T09:00:00Z",
            "worksetId": wid,
        },
    )
    assert tagged.status_code == 201
    assert tagged.json()["worksetId"] == wid

    filtered = await client.get("/api/v1/calendar/user-events", params={"workset_id": wid})
    assert filtered.status_code == 200
    assert any(row["id"] == tagged.json()["id"] for row in filtered.json())
    assert all(row["worksetId"] == wid for row in filtered.json())


async def test_unknown_workset_id_rejected_on_task_create(client):
    resp = await client.post(
        "/api/v1/tasks",
        json={
            "name": "Bad ownership",
            "analysisMode": "event",
            "promptTemplate": "x",
            "worksetId": "missing-workset",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error_code"] == "VALIDATION_ERROR"

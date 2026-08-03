"""parent_task_id write invariants (recurring child under project only)."""

from __future__ import annotations

import pytest

from server.services.task_writes import TaskWriteError, resolve_parent_task_id
from server.tests import seed


def test_resolve_parent_clears_for_non_recurring() -> None:
    assert (
        resolve_parent_task_id(
            task_id="child",
            effective_mode="event",
            supplied_parent_task_id="proj",
            existing_parent_task_id="proj",
        )
        is None
    )


def test_resolve_parent_rejects_self_reference() -> None:
    with pytest.raises(TaskWriteError, match="itself"):
        resolve_parent_task_id(
            task_id="same",
            effective_mode="recurring",
            supplied_parent_task_id="same",
        )


def test_resolve_parent_rejects_non_project_parent_mode() -> None:
    with pytest.raises(TaskWriteError, match="project"):
        resolve_parent_task_id(
            task_id="child",
            effective_mode="recurring",
            supplied_parent_task_id="not-proj",
            parent_mode="event",
        )


async def test_put_task_mode_change_clears_parent(client, app) -> None:
    """Changing away from recurring clears parent_task_id on the row."""
    create_proj = await client.post(
        "/api/v1/tasks",
        json={
            "name": "Parent Project",
            "analysisMode": "project",
            "promptTemplate": "x",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create_proj.status_code == 201
    proj_id = create_proj.json()["id"]

    from server.services.recurring_task_writes import create_recurring_task

    row = await create_recurring_task(
        app.state.db,
        name="Child Standup",
        rrule="FREQ=WEEKLY;BYDAY=MO",
        event_start_time="10:00",
        parent_task_id=proj_id,
    )
    child_id = str(row["id"])
    assert row.get("parent_task_id") == proj_id

    update = await client.put(
        f"/api/v1/tasks/{child_id}",
        json={
            "name": "Child Standup",
            "promptTemplate": "",
            "analysisMode": "event",
            "analysisTimeRange": "1d",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert update.status_code == 200
    assert update.json()["parentTaskId"] is None
    assert update.json()["analysisMode"] == "event"

    db_row = await app.state.db.fetch_one(
        "SELECT analysis_mode FROM analysis_tasks WHERE id = ?",
        (child_id,),
    )
    assert db_row["analysis_mode"] == "event"
    assert (
        await app.state.db.fetch_one(
            "SELECT task_id FROM recurring_schedules WHERE task_id = ?",
            (child_id,),
        )
        is None
    )


async def test_put_project_mode_change_clears_children_parent(client, app) -> None:
    """Changing a project away from project mode clears children parent_task_id."""
    create_proj = await client.post(
        "/api/v1/tasks",
        json={
            "name": "Leaving Project",
            "analysisMode": "project",
            "promptTemplate": "x",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create_proj.status_code == 201
    proj_id = create_proj.json()["id"]

    from server.services.recurring_task_writes import create_recurring_task

    child = await create_recurring_task(
        app.state.db,
        name="Was Child",
        rrule="FREQ=DAILY",
        event_start_time="08:00",
        parent_task_id=proj_id,
    )
    child_id = str(child["id"])
    assert child.get("parent_task_id") == proj_id

    update = await client.put(
        f"/api/v1/tasks/{proj_id}",
        json={
            "name": "Leaving Project",
            "promptTemplate": "x",
            "analysisMode": "event",
            "analysisTimeRange": "1d",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert update.status_code == 200
    assert update.json()["analysisMode"] == "event"
    assert update.json()["parentTaskId"] is None

    child_row = await app.state.db.fetch_one(
        "SELECT analysis_mode FROM analysis_tasks WHERE id = ?",
        (child_id,),
    )
    assert child_row["analysis_mode"] == "recurring"
    schedule = await app.state.db.fetch_one(
        "SELECT parent_task_id FROM recurring_schedules WHERE task_id = ?",
        (child_id,),
    )
    assert schedule is not None
    assert schedule["parent_task_id"] is None


async def test_rest_create_recurring_requires_start_clock(client) -> None:
    """Atomic create / schedule PUT require start clock unless all-day."""
    missing = await client.post(
        "/api/v1/tasks/recurring",
        json={"name": "No Clock", "rrule": "FREQ=DAILY"},
    )
    assert missing.status_code == 422
    assert "eventStartTime" in missing.json()["message"]

    # Shell path on POST /tasks is hard-cut.
    shell = await client.post(
        "/api/v1/tasks",
        json={
            "name": "No Clock Shell",
            "promptTemplate": "",
            "analysisMode": "recurring",
            "channelIds": [],
        },
    )
    assert shell.status_code == 422
    assert "POST /tasks/recurring" in shell.json()["message"]

    ok = await client.post(
        "/api/v1/tasks/recurring",
        json={"name": "With Clock", "rrule": "FREQ=DAILY", "eventStartTime": "09:30"},
    )
    assert ok.status_code == 201, ok.text
    task_id = ok.json()["id"]
    schedule = await client.get(f"/api/v1/tasks/{task_id}/schedule")
    assert schedule.status_code == 200
    body = schedule.json()
    assert body["rrule"] == "FREQ=DAILY"
    assert body["eventStartTime"] == "09:30"
    assert body["taskId"] == task_id


async def test_list_tasks_top_level_only_hides_children(client, app) -> None:
    create_proj = await client.post(
        "/api/v1/tasks",
        json={
            "name": "Top Project",
            "analysisMode": "project",
            "promptTemplate": "x",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    proj_id = create_proj.json()["id"]
    from server.services.recurring_task_writes import create_recurring_task

    child = await create_recurring_task(
        app.state.db,
        name="Hidden Child",
        rrule="FREQ=DAILY",
        event_start_time="09:00",
        parent_task_id=proj_id,
    )

    all_tasks = await client.get("/api/v1/tasks")
    ids = {t["id"] for t in all_tasks.json()}
    assert child["id"] in ids
    assert proj_id in ids

    top = await client.get("/api/v1/tasks", params={"top_level_only": "true"})
    top_ids = {t["id"] for t in top.json()}
    assert child["id"] not in top_ids
    assert proj_id in top_ids
    # Seeded tasks remain top-level.
    assert seed.TASK_LEADERBOARD in top_ids

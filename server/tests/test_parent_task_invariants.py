"""parent_task_id write invariants (recurring child under project only)."""

from __future__ import annotations

import pytest

from server.services.task_writes import (
    TaskWriteError,
    resolve_parent_task_id,
    resolve_series_parent_task_id,
)
from server.tests import seed


def test_resolve_parent_clears_for_non_recurring() -> None:
    assert (
        resolve_parent_task_id(
            task_id="child",
            effective_mode="intel_event",
            supplied_parent_task_id="proj",
            existing_parent_task_id="proj",
        )
        is None
    )


def test_resolve_parent_rejects_self_reference() -> None:
    with pytest.raises(TaskWriteError, match="itself"):
        resolve_series_parent_task_id(
            series_id="same",
            supplied_parent_task_id="same",
        )


def test_resolve_parent_rejects_non_agent_parent_mode() -> None:
    with pytest.raises(TaskWriteError, match="agent"):
        resolve_series_parent_task_id(
            series_id="child",
            supplied_parent_task_id="not-proj",
            parent_mode="intel_event",
        )


_AGENT_PARENT = {
    "analysisMode": "agent",
    "promptTemplate": "x",
    "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
    "scheduleRrule": "FREQ=HOURLY",
    "triggerMode": "message_cursor",
    "capCalendarRead": True,
    "capCalendarWrites": True,
    "outputCalendar": True,
    "outputAnalysisEvents": False,
}


async def test_series_is_not_mutable_through_task_routes(client, app) -> None:
    """A standalone series id never becomes an analysis-task shell."""
    create_proj = await client.post(
        "/api/v1/tasks",
        json={
            "name": "Parent Project",
            **_AGENT_PARENT,
        },
    )
    assert create_proj.status_code == 201
    proj_id = create_proj.json()["id"]

    from server.services.recurring_series_writes import create_recurring_series

    row = await create_recurring_series(
        app.state.db,
        name="Child Standup",
        rrule="FREQ=WEEKLY;BYDAY=MO",
        event_start_time="10:00",
        parent_task_id=proj_id,
    )
    series_id = str(row["id"])
    assert row.get("parent_task_id") == proj_id

    update = await client.put(
        f"/api/v1/tasks/{series_id}",
        json={
            "name": "Child Standup",
            "promptTemplate": "",
            "analysisMode": "intel_event",
            "analysisTimeRange": "1d",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert update.status_code == 404

    db_row = await app.state.db.fetch_one(
        "SELECT id FROM analysis_tasks WHERE id = ?",
        (series_id,),
    )
    assert db_row is None
    series_row = await app.state.db.fetch_one(
        "SELECT parent_task_id FROM recurring_schedules WHERE id = ?",
        (series_id,),
    )
    assert series_row is not None
    assert series_row["parent_task_id"] == proj_id


async def test_put_project_mode_change_clears_children_parent(client, app) -> None:
    """Changing an agent parent away from agent mode clears children parent_task_id."""
    create_proj = await client.post(
        "/api/v1/tasks",
        json={
            "name": "Leaving Project",
            **_AGENT_PARENT,
        },
    )
    assert create_proj.status_code == 201
    proj_id = create_proj.json()["id"]

    from server.services.recurring_series_writes import create_recurring_series

    child = await create_recurring_series(
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
            "analysisMode": "intel_event",
            "analysisTimeRange": "1d",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert update.status_code == 200
    assert update.json()["analysisMode"] == "intel_event"
    assert update.json()["parentTaskId"] is None

    schedule = await app.state.db.fetch_one(
        "SELECT parent_task_id FROM recurring_schedules WHERE id = ?",
        (child_id,),
    )
    assert schedule is not None
    assert schedule["parent_task_id"] is None


async def test_rest_create_recurring_requires_start_clock(client) -> None:
    """Standalone series creation requires a start clock unless all-day."""
    missing = await client.post(
        "/api/v1/calendar/recurring",
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

    ok = await client.post(
        "/api/v1/calendar/recurring",
        json={"name": "With Clock", "rrule": "FREQ=DAILY", "eventStartTime": "09:30"},
    )
    assert ok.status_code == 201, ok.text
    series_id = ok.json()["id"]
    schedule = await client.get(f"/api/v1/calendar/recurring/{series_id}")
    assert schedule.status_code == 200
    body = schedule.json()
    assert body["rrule"] == "FREQ=DAILY"
    assert body["eventStartTime"] == "09:30"
    assert body["id"] == series_id


async def test_task_catalog_excludes_series_and_calendar_top_level_hides_children(client, app) -> None:
    create_proj = await client.post(
        "/api/v1/tasks",
        json={
            "name": "Top Project",
            **_AGENT_PARENT,
        },
    )
    proj_id = create_proj.json()["id"]
    from server.services.recurring_series_writes import create_recurring_series

    child = await create_recurring_series(
        app.state.db,
        name="Hidden Child",
        rrule="FREQ=DAILY",
        event_start_time="09:00",
        parent_task_id=proj_id,
    )

    all_tasks = await client.get("/api/v1/tasks")
    ids = {t["id"] for t in all_tasks.json()}
    assert child["id"] not in ids
    assert proj_id in ids

    all_series = await client.get("/api/v1/calendar/recurring")
    assert child["id"] in {row["id"] for row in all_series.json()["items"]}

    top = await client.get("/api/v1/calendar/recurring", params={"topLevelOnly": "true"})
    top_ids = {row["id"] for row in top.json()["items"]}
    assert child["id"] not in top_ids
    assert seed.SERIES_CALENDAR in top_ids

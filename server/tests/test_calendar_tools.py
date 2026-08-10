"""Contract tests for calendar tool limits and dispatch."""

from __future__ import annotations

from server.agent.tools_calendar import (
    HARD_CAP,
    TOOL_NAMES,
    TOOL_SCHEMAS,
    execute_calendar_tool,
)
from server.calendar.query import HORIZON_DAYS
from server.tests import seed


async def test_tool_names_match_plan(app) -> None:
    assert TOOL_NAMES == {
        "calendar.list_calendars",
        "calendar.upcoming",
        "calendar.recent",
        "calendar.window",
        "calendar.get",
        "calendar.create_event",
        "calendar.create_recurring_task",
        "calendar.update_recurring_task",
        "calendar.delete_recurring_task",
        "calendar.update_event",
        "calendar.delete_event",
        "calendar.mark_important",
        "calendar.unmark_important",
    }
    result = await execute_calendar_tool(app.state.db, "calendar.list_calendars", {})
    assert result["count"] >= 1
    assert any(c["id"] == seed.TASK_CALENDAR for c in result["calendars"])


async def test_create_recurring_task_weekly(app) -> None:
    db = app.state.db
    before = await db.fetch_all("SELECT id, analysis_mode FROM analysis_tasks WHERE analysis_mode != 'recurring'")
    created = await execute_calendar_tool(
        db,
        "calendar.create_recurring_task",
        {
            "name": "睇電視",
            "rrule": "FREQ=WEEKLY;BYDAY=WE",
            "eventStartTime": "10:00",
            "eventEndTime": "11:00",
        },
    )
    assert "error" not in created
    task = created["task"]
    assert task["name"] == "睇電視"
    assert task["analysisMode"] == "recurring"
    assert task["rrule"] == "FREQ=WEEKLY;BYDAY=WE"
    assert task["eventStartTime"] == "10:00"
    assert task["eventEndTime"] == "11:00"
    assert task["isActive"] is True

    row = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task["id"],))
    assert row is not None
    assert row["analysis_mode"] == "recurring"
    assert row["prompt_template"] == ""

    after = await db.fetch_all("SELECT id, analysis_mode FROM analysis_tasks WHERE analysis_mode != 'recurring'")
    assert {(r["id"], r["analysis_mode"]) for r in after} == {(r["id"], r["analysis_mode"]) for r in before}

    listed = await execute_calendar_tool(db, "calendar.list_calendars", {})
    assert any(c["id"] == task["id"] and c["analysisMode"] == "recurring" for c in listed["calendars"])


async def test_create_recurring_task_appears_in_upcoming(app) -> None:
    db = app.state.db
    created = await execute_calendar_tool(
        db,
        "calendar.create_recurring_task",
        {
            "name": "每日循環測試",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "10:00",
            "eventEndTime": "10:30",
        },
    )
    assert "error" not in created
    task_id = created["task"]["id"]

    upcoming = await execute_calendar_tool(
        db,
        "calendar.upcoming",
        {"days": 7, "taskId": task_id, "limit": 50},
    )
    assert "error" not in upcoming
    matches = [item for item in upcoming["items"] if item.get("taskId") == task_id]
    assert matches, "expected RRULE occurrences from the new calendar task"
    assert any(item.get("title") == "每日循環測試" for item in matches)


async def test_create_recurring_task_rejects_bad_rrule_and_missing_time(app) -> None:
    db = app.state.db
    bad = await execute_calendar_tool(
        db,
        "calendar.create_recurring_task",
        {"name": "壞規則", "rrule": "FREQ=BOGUS", "eventStartTime": "09:00"},
    )
    assert "error" in bad

    missing_time = await execute_calendar_tool(
        db,
        "calendar.create_recurring_task",
        {"title": "缺時間", "rrule": "FREQ=DAILY"},
    )
    assert "error" in missing_time

    all_day = await execute_calendar_tool(
        db,
        "calendar.create_recurring_task",
        {"title": "全日", "rrule": "FREQ=WEEKLY;BYDAY=MO", "eventIsAllDay": True},
    )
    assert "error" not in all_day
    assert all_day["task"]["eventIsAllDay"] is True
    assert all_day["task"]["eventStartTime"] is None


async def test_update_and_delete_recurring_task_tools(app) -> None:
    db = app.state.db
    created = await execute_calendar_tool(
        db,
        "calendar.create_recurring_task",
        {
            "name": "週三睇電視",
            "rrule": "FREQ=WEEKLY;BYDAY=WE",
            "eventStartTime": "10:00",
        },
    )
    assert "error" not in created
    task_id = created["task"]["id"]

    updated = await execute_calendar_tool(
        db,
        "calendar.update_recurring_task",
        {
            "id": task_id,
            "name": "週五睇電視",
            "rrule": "FREQ=WEEKLY;BYDAY=FR",
            "eventStartTime": "21:00",
        },
    )
    assert "error" not in updated
    assert updated["task"]["name"] == "週五睇電視"
    assert updated["task"]["rrule"] == "FREQ=WEEKLY;BYDAY=FR"
    assert updated["task"]["eventStartTime"] == "21:00"

    # Refuse to mutate a non-recurring task (seeded event-mode task).
    refused = await execute_calendar_tool(
        db,
        "calendar.update_recurring_task",
        {"id": seed.TASK_EVENT, "name": "不該改"},
    )
    assert "error" in refused
    assert "recurring" in refused["error"] or "calendar" in refused["error"]

    deleted = await execute_calendar_tool(
        db,
        "calendar.delete_recurring_task",
        {"id": task_id},
    )
    assert deleted["deleted"] is True
    assert deleted["soft"] is True
    assert deleted["task"]["isActive"] is False
    row = await db.fetch_one("SELECT id, is_active FROM analysis_tasks WHERE id = ?", (task_id,))
    assert row is not None
    assert int(row["is_active"]) == 0

    # Soft-deleted series must not expand into occurrences.
    from datetime import datetime, timezone

    from server.calendar.query import expand_active_calendar_occurrences

    occs = await expand_active_calendar_occurrences(
        db,
        datetime(2026, 7, 1, tzinfo=timezone.utc),
        datetime(2026, 8, 1, tzinfo=timezone.utc),
        task_id=task_id,
    )
    assert occs == []

    # Re-activate via update.
    resumed = await execute_calendar_tool(
        db,
        "calendar.update_recurring_task",
        {"id": task_id, "isActive": True},
    )
    assert resumed["task"]["isActive"] is True

    refuse_delete = await execute_calendar_tool(
        db,
        "calendar.delete_recurring_task",
        {"id": seed.TASK_EVENT},
    )
    assert refuse_delete.get("deleted") is False
    assert "error" in refuse_delete
    still = await db.fetch_one("SELECT id FROM analysis_tasks WHERE id = ?", (seed.TASK_EVENT,))
    assert still is not None


async def test_delete_analysis_task_clears_calendar_dismissals(app) -> None:
    """REST hard-delete path clears RRULE occurrence dismissals for that task."""
    from server.queries.tasks_queries import delete_analysis_task
    from server.util import utc_now_iso

    db = app.state.db
    created = await execute_calendar_tool(
        db,
        "calendar.create_recurring_task",
        {
            "name": "硬刪清理",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "08:00",
        },
    )
    task_id = created["task"]["id"]
    other = await execute_calendar_tool(
        db,
        "calendar.create_recurring_task",
        {
            "name": "保留",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "09:00",
        },
    )
    other_id = other["task"]["id"]
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("recurring", f"{task_id}:20260723T000000Z", now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("recurring", f"{other_id}:20260723T010000Z", now),
    )

    await delete_analysis_task(db, task_id)

    assert await db.fetch_one("SELECT id FROM analysis_tasks WHERE id = ?", (task_id,)) is None
    assert (
        await db.fetch_value(
            "SELECT COUNT(*) FROM timeline_dismissals WHERE source = 'recurring' AND event_id LIKE ?",
            (f"{task_id}:%",),
        )
        == 0
    )
    assert (
        await db.fetch_value(
            "SELECT COUNT(*) FROM timeline_dismissals WHERE source = 'recurring' AND event_id LIKE ?",
            (f"{other_id}:%",),
        )
        == 1
    )


async def test_upcoming_days_schema_matches_horizon() -> None:
    upcoming = next(s for s in TOOL_SCHEMAS if s["name"] == "calendar.upcoming")
    assert upcoming["parameters"]["properties"]["days"]["maximum"] == HORIZON_DAYS
    assert HORIZON_DAYS == 365


async def test_upcoming_and_recent_hard_cap(app) -> None:
    db = app.state.db
    upcoming = await execute_calendar_tool(db, "calendar.upcoming", {"limit": 10_000})
    assert upcoming["limit"] == HARD_CAP
    assert len(upcoming["items"]) <= HARD_CAP

    recent = await execute_calendar_tool(db, "calendar.recent", {"limit": 999})
    assert recent["limit"] == HARD_CAP
    assert len(recent["items"]) <= HARD_CAP


async def test_window_requires_bounds_and_caps_limit(app) -> None:
    db = app.state.db
    missing = await execute_calendar_tool(db, "calendar.window", {})
    assert "error" in missing

    capped = await execute_calendar_tool(
        db,
        "calendar.window",
        {
            "start": "2026-07-01T00:00:00Z",
            "end": "2026-08-01T00:00:00Z",
            "limit": 500,
        },
    )
    assert capped["limit"] == HARD_CAP
    assert len(capped["items"]) <= HARD_CAP
    assert all("startTime" in item and "endTime" in item for item in capped["items"])
    assert all("start" not in item and "end" not in item for item in capped["items"])

    via_results_aliases = await execute_calendar_tool(
        db,
        "calendar.window",
        {
            "startTime": "2026-07-01T00:00:00Z",
            "endTime": "2026-08-01T00:00:00Z",
            "limit": 10,
        },
    )
    assert "error" not in via_results_aliases
    assert len(via_results_aliases["items"]) >= 1


async def test_get_tool_returns_seeded_event(app) -> None:
    result = await execute_calendar_tool(app.state.db, "calendar.get", {"id": "ev-1"})
    assert result["item"]["id"] == "ev-1"
    assert result["item"]["title"] == "季度會議"

    missing = await execute_calendar_tool(app.state.db, "calendar.get", {"id": "no-such"})
    assert missing["item"] is None
    assert "error" in missing


async def test_get_tool_accepts_event_id_alias(app) -> None:
    via_alias = await execute_calendar_tool(app.state.db, "calendar.get", {"event_id": "ev-1"})
    assert via_alias["item"]["id"] == "ev-1"


async def test_unknown_tool_returns_error(app) -> None:
    result = await execute_calendar_tool(app.state.db, "calendar.nope", {})
    assert "unknown tool" in result["error"]


async def test_create_update_delete_user_event_tools(app) -> None:
    db = app.state.db
    created = await execute_calendar_tool(
        db,
        "calendar.create_event",
        {
            "title": "助手建立的會議",
            "startTime": "2026-07-22T10:00:00Z",
            "endTime": "2026-07-22T11:00:00Z",
            "location": "會議室 A",
        },
    )
    assert "error" not in created
    item = created["item"]
    assert item["title"] == "助手建立的會議"
    assert item["source"] == "user"
    assert item["origin"] == "assistant"
    assert item["kind"] == "normal"
    assert item.get("amount") is None
    event_id = item["id"]

    updated = await execute_calendar_tool(
        db,
        "calendar.update_event",
        {"id": event_id, "title": "助手修正的會議"},
    )
    assert updated["item"]["title"] == "助手修正的會議"

    deleted = await execute_calendar_tool(db, "calendar.delete_event", {"id": event_id})
    assert deleted["deleted"] is True
    assert deleted["dismissed"] is True
    assert deleted["source"] == "user"

    missing = await execute_calendar_tool(db, "calendar.get", {"id": event_id})
    assert missing["item"] is None
    assert "error" in missing

    row = await db.fetch_one("SELECT id FROM user_events WHERE id = ?", (event_id,))
    assert row is not None
    marker = await db.fetch_one(
        "SELECT 1 FROM timeline_dismissals WHERE source = 'user' AND event_id = ?",
        (event_id,),
    )
    assert marker is not None


async def test_calendar_write_tools_publish_resource_modified(app) -> None:
    from server.agent.tools_registry import execute_tool

    db = app.state.db
    broadcaster = app.state.broadcaster
    queue = broadcaster.subscribe()
    try:
        created_task = await execute_tool(
            db,
            "calendar.create_recurring_task",
            {
                "name": "SSE 循環",
                "rrule": "FREQ=DAILY",
                "eventStartTime": "08:00",
            },
            context={"broadcaster": broadcaster},
        )
        assert "error" not in created_task
        task_id = created_task["task"]["id"]

        updated_task = await execute_tool(
            db,
            "calendar.update_recurring_task",
            {"id": task_id, "name": "SSE 循環改"},
            context={"broadcaster": broadcaster},
        )
        assert "error" not in updated_task

        soft_deleted = await execute_tool(
            db,
            "calendar.delete_recurring_task",
            {"id": task_id},
            context={"broadcaster": broadcaster},
        )
        assert soft_deleted.get("deleted") is True
        assert soft_deleted.get("soft") is True

        created_event = await execute_tool(
            db,
            "calendar.create_event",
            {
                "title": "SSE 單次",
                "startTime": "2026-07-28T12:00:00Z",
            },
            context={"broadcaster": broadcaster, "user_event_origin": "assistant"},
        )
        assert "error" not in created_event
        event_id = created_event["item"]["id"]

        updated_event = await execute_tool(
            db,
            "calendar.update_event",
            {"id": event_id, "title": "SSE 單次改"},
            context={"broadcaster": broadcaster, "user_event_origin": "assistant"},
        )
        assert "error" not in updated_event

        deleted_event = await execute_tool(
            db,
            "calendar.delete_event",
            {"id": event_id},
            context={"broadcaster": broadcaster},
        )
        assert deleted_event.get("deleted") is True

        events = [queue.get_nowait() for _ in range(6)]
    finally:
        broadcaster.unsubscribe(queue)

    import json

    payloads = [json.loads(event["data"])["payload"] for event in events]
    assert payloads == [
        {"resourceType": "task", "resourceId": task_id, "action": "created"},
        {"resourceType": "task", "resourceId": task_id, "action": "updated"},
        {"resourceType": "task", "resourceId": task_id, "action": "updated"},
        {"resourceType": "user_event", "resourceId": event_id, "action": "created"},
        {"resourceType": "user_event", "resourceId": event_id, "action": "updated"},
        {"resourceType": "user_event", "resourceId": event_id, "action": "deleted"},
    ]

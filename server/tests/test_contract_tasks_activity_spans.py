"""Contract keys: tasks activity-spans routes."""

from __future__ import annotations

import pytest

from server.tests import seed
from server.tests.contract_helpers import assert_keys


async def test_activity_spans(client):
    resp = await client.get("/api/v1/tasks/activity-spans")
    body = resp.json()
    # Seed has 5 analysis tasks; the calendar series lives on recurring_schedules.
    assert len(body) == 5
    for span in body:
        assert_keys(
            span,
            [
                "taskId",
                "taskName",
                "description",
                "analysisTimeRange",
                "isActive",
                "earliestBatchStart",
                "latestBatchEnd",
                "completedBatchCount",
                "lastAgentMessage",
                "lastToolCalls",
                "lastErrorMessage",
                "lastMessageCount",
                "sourceKind",
                "worksetId",
            ],
            "TaskActivitySpan",
        )
    lb = next(s for s in body if s["taskId"] == seed.TASK_LEADERBOARD)
    assert lb["completedBatchCount"] == 1
    assert lb["sourceKind"] == "task"
    assert lb["worksetId"] is None


async def test_activity_spans_include_virtual_user_events_source(client):
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "手動排程",
            "startTime": "2026-07-21T09:00:00Z",
            "endTime": "2026-07-21T11:00:00Z",
        },
    )
    assert created.status_code == 201

    spans = (await client.get("/api/v1/tasks/activity-spans")).json()
    user_span = next(span for span in spans if span["worksetId"] == "__user__")
    assert user_span["taskName"] == "一般"
    assert user_span["sourceKind"] == "workset"
    assert user_span["worksetId"] == "__user__"
    assert user_span["taskId"] is None
    assert user_span["earliestBatchStart"] == "2026-07-21T09:00:00Z"
    assert user_span["latestBatchEnd"] == "2026-07-21T11:00:00Z"
    assert user_span["completedBatchCount"] == 1


async def test_activity_spans_group_user_events_by_workset(client):
    """user_events produce one workset-kind span per distinct workset_id."""
    ws = await client.post("/api/v1/worksets", json={"name": "Alpha WS"})
    assert ws.status_code == 201
    workset_id = ws.json()["id"]

    sys_evt = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "System WS event",
            "startTime": "2026-07-21T09:00:00Z",
            "endTime": "2026-07-21T10:00:00Z",
        },
    )
    assert sys_evt.status_code == 201

    custom_a = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Custom A",
            "startTime": "2026-07-22T09:00:00Z",
            "endTime": "2026-07-22T11:00:00Z",
            "worksetId": workset_id,
        },
    )
    assert custom_a.status_code == 201
    custom_b = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Custom B",
            "startTime": "2026-07-23T12:00:00Z",
            "endTime": "2026-07-23T13:00:00Z",
            "worksetId": workset_id,
        },
    )
    assert custom_b.status_code == 201

    spans = (await client.get("/api/v1/tasks/activity-spans")).json()
    workset_spans = [s for s in spans if s["sourceKind"] == "workset"]
    by_id = {s["worksetId"]: s for s in workset_spans}

    assert "__user__" in by_id
    assert by_id["__user__"]["taskName"] == "一般"
    assert by_id["__user__"]["worksetId"] == "__user__"
    assert by_id["__user__"]["taskId"] is None
    assert by_id["__user__"]["completedBatchCount"] == 1
    assert by_id["__user__"]["earliestBatchStart"] == "2026-07-21T09:00:00Z"

    assert workset_id in by_id
    assert by_id[workset_id]["taskName"] == "Alpha WS"
    assert by_id[workset_id]["worksetId"] == workset_id
    assert by_id[workset_id]["taskId"] is None
    assert by_id[workset_id]["completedBatchCount"] == 2
    assert by_id[workset_id]["earliestBatchStart"] == "2026-07-22T09:00:00Z"
    assert by_id[workset_id]["latestBatchEnd"] == "2026-07-23T13:00:00Z"

    for span in spans:
        if span["sourceKind"] == "task":
            assert span["worksetId"] is None
            assert span["taskId"] is not None
        else:
            assert span["worksetId"] is not None
            assert span["taskId"] is None


async def test_activity_spans_excludes_old_version_batches(client):
    """Version bump should stop old completed batches from counting in Gantt stats."""
    before = (await client.get("/api/v1/tasks/activity-spans")).json()
    lb_before = next(s for s in before if s["taskId"] == seed.TASK_LEADERBOARD)
    assert lb_before["completedBatchCount"] == 1

    update = await client.put(
        f"/api/v1/tasks/{seed.TASK_LEADERBOARD}",
        json={
            "name": "Leaderboard v2",
            "promptTemplate": "分析 v2",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "all",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=SECONDLY;INTERVAL=10",
        },
    )
    assert update.status_code == 200
    assert update.json()["version"] == 2

    after = (await client.get("/api/v1/tasks/activity-spans")).json()
    lb_after = next(s for s in after if s["taskId"] == seed.TASK_LEADERBOARD)
    assert lb_after["completedBatchCount"] == 0


@pytest.mark.asyncio
async def test_activity_spans_include_last_tick_summary(app, client):
    """Latest completed batch agent_message / tool_calls_json surface on spans."""
    db = app.state.db
    await db.execute(
        "UPDATE analysis_batches SET agent_message = ?, tool_calls_json = ? WHERE task_id = ? AND status = 'completed'",
        (
            "tick summary",
            '[{"name":"calendar.upcoming","arguments":{"limit":3},"resultSummary":"0 items"}]',
            seed.TASK_LEADERBOARD,
        ),
    )
    spans = (await client.get("/api/v1/tasks/activity-spans")).json()
    lb = next(s for s in spans if s["taskId"] == seed.TASK_LEADERBOARD)
    assert lb["lastAgentMessage"] == "tick summary"
    assert lb["lastToolCalls"][0]["name"] == "calendar.upcoming"
    assert lb["lastToolCalls"][0]["resultSummary"] == "0 items"

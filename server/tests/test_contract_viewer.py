"""Contract keys: viewer routes."""

from __future__ import annotations

from server.tests import seed
from server.tests.contract_helpers import assert_keys


async def test_viewer_tasks(client):
    resp = await client.get("/api/v1/viewer/tasks")
    body = resp.json()
    # Seed has 5 analysis tasks; the calendar series lives on recurring_schedules.
    assert len(body) == 5
    for task in body:
        assert_keys(task, ["id", "name", "isActive"], "viewer task")
    lb = next(t for t in body if t["id"] == seed.TASK_LEADERBOARD)
    assert "lastAnalysisAt" in lb  # has a completed batch


async def test_viewer_stats(client):
    body = (await client.get("/api/v1/viewer/stats")).json()
    assert_keys(
        body,
        [
            "totalTasks",
            "activeTasks",
            "totalBatches",
            "completedBatches",
            "totalResults",
        ],
        "viewer stats",
    )


async def test_viewer_status(client):
    body = (await client.get("/api/v1/viewer/status")).json()
    assert_keys(
        body,
        ["queueDepth", "collectorAlive", "analysisPaused", "uptimeSeconds"],
        "viewer status",
    )
    assert isinstance(body["collectorAlive"], bool)
    assert isinstance(body["analysisPaused"], bool)

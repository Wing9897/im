"""Contract keys: tasks CRUD / templates / project-ticks."""

from __future__ import annotations

import pytest

from server.tests import seed
from server.tests.contract_helpers import assert_keys
from server.tests.contract_tasks_helpers import TASK_KEYS


async def test_list_tasks(client):
    resp = await client.get("/api/v1/tasks")
    body = resp.json()
    assert len(body) == 6
    for task in body:
        assert_keys(task, TASK_KEYS, "AnalysisTask")
        assert "parentTaskId" in task
    lb = next(t for t in body if t["id"] == seed.TASK_LEADERBOARD)
    # Quirk #8: channelIds items are ChannelRef objects in GET responses.
    assert lb["channelIds"], "leaderboard task must have channels"
    for ref in lb["channelIds"]:
        assert_keys(ref, ["id", "platform", "platformId"], "ChannelRef")
    assert lb["parentTaskId"] is None
    wi = next(t for t in body if t["id"] == seed.TASK_WEB_INTEL)
    assert wi["analysisMode"] == "web_intel"
    assert wi["webSearchQuery"]
    proj = next(t for t in body if t["id"] == seed.TASK_PROJECT)
    assert proj["analysisMode"] == "project"


async def test_invalid_analysis_time_range_returns_422(client):
    """DB CHECK must not surface as 500 — validate at the API boundary."""
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "bad range",
            "promptTemplate": "x",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "bogus",
            "scheduleRrule": "FREQ=SECONDLY;INTERVAL=10",
            "channelIds": [],
        },
    )
    assert create.status_code == 422
    body = create.json()
    assert body["error_code"] == "VALIDATION_ERROR"
    assert "analysisTimeRange" in body["message"]


async def test_create_update_delete_task_roundtrip(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "contract roundtrip",
            "description": None,
            "promptTemplate": "分析",
            "analysisMode": "event",
            "analysisTimeRange": "12h",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create.status_code == 201
    create_body = create.json()
    task_id = create_body["id"]
    assert create_body["deletedBatchCount"] == 0

    update = await client.put(
        f"/api/v1/tasks/{task_id}",
        json={
            "name": "contract roundtrip v2",
            "promptTemplate": "分析 v2",
            "analysisMode": "event",
            "analysisTimeRange": "24h",
            "channelIds": [],
            "scheduleRrule": "FREQ=DAILY;BYHOUR=8;BYMINUTE=0",
        },
    )
    assert update.status_code == 200
    update_body = update.json()
    assert update_body["version"] == 2
    assert isinstance(update_body["deletedBatchCount"], int)

    toggle = await client.patch(f"/api/v1/tasks/{task_id}/active")
    assert toggle.status_code == 200
    assert toggle.json()["isActive"] is False

    delete = await client.delete(f"/api/v1/tasks/{task_id}")
    assert delete.status_code == 200
    delete_body = delete.json()
    assert_keys(delete_body, ["taskId", "deletedBatchCount"], "TaskDeleteResult")
    assert isinstance(delete_body["deletedBatchCount"], int)


async def test_put_task_applies_optional_is_active(client, app):
    """PUT may include isActive; toggle goes through set_task_active (DB + response)."""
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "put isActive",
            "promptTemplate": "x",
            "analysisMode": "event",
            "analysisTimeRange": "12h",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create.status_code == 201
    task_id = create.json()["id"]
    assert create.json()["isActive"] is True
    version_before = create.json()["version"]

    update = await client.put(
        f"/api/v1/tasks/{task_id}",
        json={
            "name": "put isActive",
            "promptTemplate": "x",
            "analysisMode": "event",
            "analysisTimeRange": "12h",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
            "isActive": False,
        },
    )
    assert update.status_code == 200
    body = update.json()
    assert body["isActive"] is False
    # Content PUT still bumps version; the isActive toggle itself does not add another bump.
    assert body["version"] == version_before + 1

    row = await app.state.db.fetch_one(
        "SELECT is_active, version FROM analysis_tasks WHERE id = ?",
        (task_id,),
    )
    assert int(row["is_active"]) == 0
    assert int(row["version"]) == version_before + 1


async def test_create_rolls_back_task_row_when_channel_linking_fails(client, app, monkeypatch):
    """The task row and its channel links commit as one unit."""
    db = app.state.db

    async def boom(*_args, **_kwargs):
        raise RuntimeError("channel upsert exploded")

    monkeypatch.setattr("server.queries.tasks_queries.upsert_channel", boom)

    with pytest.raises(RuntimeError):
        await client.post(
            "/api/v1/tasks",
            json={
                "name": "rollback probe",
                "promptTemplate": "分析",
                "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
                "scheduleRrule": "FREQ=HOURLY",
            },
        )

    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks WHERE name = 'rollback probe'") == 0


async def test_update_rolls_back_version_bump_and_batch_deletion_together(client, app, monkeypatch):
    """A failure anywhere in the update write leaves version, batches and channels intact."""
    db = app.state.db
    task_id = seed.TASK_LEADERBOARD
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "created_at, updated_at) VALUES (?, ?, 1, 'pending', 1, 0, ?, ?)",
        ("batch-update-rollback", task_id, seed.NOW, seed.NOW),
    )
    channels_before = await db.fetch_all(
        "SELECT * FROM task_channels WHERE task_id = ? ORDER BY platform, platform_id",
        (task_id,),
    )
    assert channels_before

    async def boom(*_args, **_kwargs):
        raise RuntimeError("channel upsert exploded")

    monkeypatch.setattr("server.queries.tasks_queries.upsert_channel", boom)

    with pytest.raises(RuntimeError):
        await client.put(
            f"/api/v1/tasks/{task_id}",
            json={
                "name": "rollback probe",
                "promptTemplate": "分析",
                "analysisMode": "leaderboard",
                "channelIds": [f"{seed.DISCORD_CHANNEL[0]}:{seed.DISCORD_CHANNEL[1]}"],
                "scheduleRrule": "FREQ=HOURLY",
            },
        )

    assert await db.fetch_value("SELECT version FROM analysis_tasks WHERE id = ?", (task_id,)) == 1
    assert await db.fetch_value("SELECT name FROM analysis_tasks WHERE id = ?", (task_id,)) != "rollback probe"
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_batches WHERE id = 'batch-update-rollback'") == 1
    assert (
        await db.fetch_all(
            "SELECT * FROM task_channels WHERE task_id = ? ORDER BY platform, platform_id",
            (task_id,),
        )
        == channels_before
    )


async def test_delete_rolls_back_batch_cleanup_when_row_delete_fails(client, app, monkeypatch):
    """Batch cleanup and the task row delete commit as one unit.

    Previously the cleanup committed on its own, so a failing row delete left an
    orphan task whose pending batches were already gone and whose schedule had
    been torn down.
    """
    db = app.state.db
    task_id = seed.TASK_LEADERBOARD
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "created_at, updated_at) VALUES (?, ?, 1, 'pending', 1, 0, ?, ?)",
        ("batch-delete-rollback", task_id, seed.NOW, seed.NOW),
    )

    async def boom(*_args, **_kwargs):
        raise RuntimeError("task row delete exploded")

    monkeypatch.setattr("server.services.task_crud.delete_analysis_task", boom)

    with pytest.raises(RuntimeError):
        await client.delete(f"/api/v1/tasks/{task_id}")

    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks WHERE id = ?", (task_id,)) == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_batches WHERE id = 'batch-delete-rollback'") == 1


async def test_delete_reregisters_task_when_the_write_fails(client, app, monkeypatch):
    """A surviving task must not be left silently unscheduled."""
    calls: list[tuple[str, str]] = []

    class RecordingScheduler:
        async def register_task(self, task_id: str) -> None:
            calls.append(("register", task_id))

        async def unregister_task(self, task_id: str) -> None:
            calls.append(("unregister", task_id))

    app.state.scheduler = RecordingScheduler()

    async def boom(*_args, **_kwargs):
        raise RuntimeError("task row delete exploded")

    monkeypatch.setattr("server.services.task_crud.delete_analysis_task", boom)

    with pytest.raises(RuntimeError):
        await client.delete(f"/api/v1/tasks/{seed.TASK_LEADERBOARD}")

    assert calls == [
        ("unregister", seed.TASK_LEADERBOARD),
        ("register", seed.TASK_LEADERBOARD),
    ]


async def test_rejected_update_uses_persisted_mode_and_preserves_all_state(client, app):
    db = app.state.db
    task_id = seed.TASK_LEADERBOARD
    pending_batch_id = "batch-rejected-update-pending"
    processing_batch_id = "batch-rejected-update-processing"
    for batch_id, status in (
        (pending_batch_id, "pending"),
        (processing_batch_id, "processing"),
    ):
        await db.execute(
            "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
            "created_at, updated_at) VALUES (?, ?, 1, ?, 1, 0, ?, ?)",
            (batch_id, task_id, status, seed.NOW, seed.NOW),
        )
    for marker_id, message_id, batch_id in (
        ("marker-rejected-update-pending", "msg-2", pending_batch_id),
        ("marker-rejected-update-processing", "msg-3", processing_batch_id),
    ):
        await db.execute(
            "INSERT INTO analysis_markers (id, message_id, task_id, version, batch_id, analyzed_at) "
            "VALUES (?, ?, ?, 1, ?, ?)",
            (marker_id, message_id, task_id, batch_id, seed.NOW),
        )

    # Seed every task-owned result family so the rejected update proves that
    # version-purge logic and child cascades never start.
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, start_time, "
        "participants_json, content_hash, semantic_hash, event_key, location, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)",
        (
            "event-rejected-update",
            task_id,
            seed.BATCH_LEADERBOARD,
            "preserved event",
            "preserved body",
            seed.NOW,
            "preserved-content-hash",
            "preserved-semantic-hash",
            "preserved-event-key",
            "N/A",
            seed.NOW,
            seed.NOW,
        ),
    )

    scheduler = app.state.scheduler
    await scheduler.register_task(task_id)
    job_before = scheduler._scheduler.get_job(task_id)
    assert job_before is not None

    async def snapshot() -> dict:
        return {
            "row": await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,)),
            "channels": await db.fetch_all(
                "SELECT * FROM task_channels WHERE task_id = ? ORDER BY platform, platform_id",
                (task_id,),
            ),
            "batches": await db.fetch_all(
                "SELECT * FROM analysis_batches WHERE task_id = ? ORDER BY id",
                (task_id,),
            ),
            "markers": await db.fetch_all(
                "SELECT * FROM analysis_markers WHERE task_id = ? ORDER BY id",
                (task_id,),
            ),
            "trending": await db.fetch_all(
                "SELECT * FROM trending_topics WHERE task_id = ? ORDER BY id",
                (task_id,),
            ),
            "topic_messages": await db.fetch_all(
                "SELECT tm.* FROM topic_messages tm JOIN trending_topics tt ON tt.id = tm.topic_id "
                "WHERE tt.task_id = ? ORDER BY tm.topic_id, tm.message_id",
                (task_id,),
            ),
            "events": await db.fetch_all(
                "SELECT * FROM analysis_events WHERE task_id = ? ORDER BY id",
                (task_id,),
            ),
        }

    before = await snapshot()
    populated_state = (
        "channels",
        "batches",
        "markers",
        "trending",
        "topic_messages",
        "events",
    )
    assert all(before[key] for key in populated_state)
    assert {batch["status"] for batch in before["batches"]} >= {"pending", "processing"}

    queue = app.state.broadcaster.subscribe()
    try:
        resp = await client.put(
            f"/api/v1/tasks/{task_id}",
            json={
                "name": "must not persist",
                "description": "must not persist",
                "promptTemplate": "must not persist",
                # analysisMode is intentionally omitted: the persisted
                # leaderboard mode must make this an analysis-task write.
                "analysisTimeRange": "7d",
                "channelIds": [f"{seed.DISCORD_CHANNEL[0]}:{seed.DISCORD_CHANNEL[1]}"],
                "scheduleRrule": "FREQ=DAILY;BYHOUR=8;BYMINUTE=0",
                # Legacy recurring field — rejected by TaskConfigBody(extra=forbid).
                "rrule": "FREQ=DAILY",
            },
        )
    finally:
        app.state.broadcaster.unsubscribe(queue)

    assert resp.status_code == 422
    assert await snapshot() == before
    assert before["row"]["version"] == 1
    assert scheduler._scheduler.get_job(task_id) is job_before
    assert queue.empty()


async def test_task_templates(client):
    resp = await client.get("/api/v1/tasks/templates")
    body = resp.json()
    assert body, "templates must not be empty"
    for preset in body:
        assert_keys(
            preset,
            ["id", "name", "description", "analysisMode", "promptTemplate", "defaultAnalysisTimeRange", "badge"],
            "TaskTemplatePreset",
        )


@pytest.mark.asyncio
async def test_project_tick_status_log(app, client):
    """Project detail can load cursor backlog + success/error tick outcomes."""
    from server.db.database import TransactionDb
    from server.queries.tasks_queries import insert_analysis_task
    from server.util import new_id, utc_now_iso

    db = app.state.db
    task_id = new_id()
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_analysis_task(
            TransactionDb(conn),
            task_id=task_id,
            name="Tick Log Project",
            description=None,
            prompt_template="goals",
            analysis_mode="project",
            analysis_time_range="all",
            schedule_rrule="FREQ=HOURLY",
            rrule=None,
            event_start_time=None,
            event_end_time=None,
            event_is_all_day=0,
            event_location=None,
            event_description=None,
            now=now,
        )
    ok_batch = new_id()
    err_batch = new_id()
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "error_message, agent_message, tool_calls_json, created_at, updated_at, completed_at) "
        "VALUES (?, ?, 1, 'completed', 3, 0, NULL, 'ok wave', '[]', ?, ?, ?)",
        (ok_batch, task_id, now, now, "2026-07-28T10:00:00Z"),
    )
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "error_message, agent_message, tool_calls_json, created_at, updated_at, completed_at) "
        "VALUES (?, ?, 1, 'completed', 0, 0, 'llm timeout', NULL, NULL, ?, ?, ?)",
        (err_batch, task_id, now, now, "2026-07-28T11:00:00Z"),
    )

    resp = await client.get(f"/api/v1/tasks/{task_id}/project-ticks")
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["taskId", "cursorAt", "pendingSinceCursor", "ticks", "inFlight"], "ProjectTickStatus")
    assert body["taskId"] == task_id
    assert isinstance(body["pendingSinceCursor"], int)
    assert body["inFlight"] is None
    assert len(body["ticks"]) >= 2
    for entry in body["ticks"]:
        assert_keys(
            entry,
            [
                "batchId",
                "status",
                "outcome",
                "messageCount",
                "agentMessage",
                "errorMessage",
                "toolCalls",
                "createdAt",
                "completedAt",
            ],
            "ProjectTickLogEntry",
        )
    by_id = {item["batchId"]: item for item in body["ticks"]}
    assert by_id[ok_batch]["outcome"] == "success"
    assert by_id[ok_batch]["messageCount"] == 3
    assert by_id[err_batch]["outcome"] == "error"
    assert by_id[err_batch]["errorMessage"] == "llm timeout"

    processing = new_id()
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "error_message, agent_message, tool_calls_json, created_at, updated_at, completed_at) "
        "VALUES (?, ?, 1, 'processing', 80, 0, NULL, NULL, NULL, ?, ?, NULL)",
        (processing, task_id, now, now),
    )
    body2 = (await client.get(f"/api/v1/tasks/{task_id}/project-ticks")).json()
    assert body2["inFlight"] is not None
    assert body2["inFlight"]["batchId"] == processing
    assert body2["inFlight"]["status"] == "processing"
    assert body2["inFlight"]["messageCount"] == 80
    assert_keys(
        body2["inFlight"],
        ["batchId", "status", "messageCount", "createdAt", "updatedAt"],
        "ProjectTickInFlight",
    )

    spans = (await client.get("/api/v1/tasks/activity-spans")).json()
    span = next(s for s in spans if s["taskId"] == task_id)
    assert span["lastErrorMessage"] == "llm timeout"
    assert span["lastAgentMessage"] is None

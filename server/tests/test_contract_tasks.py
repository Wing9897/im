"""Contract keys: tasks routes."""

from __future__ import annotations

import pytest

from server.tests import seed
from server.tests.contract_helpers import assert_keys

TASK_KEYS = [
    "id",
    "name",
    "description",
    "promptTemplate",
    "analysisMode",
    "analysisTimeRange",
    "isActive",
    "channelIds",
    "scheduleType",
    "scheduleValue",
    "rrule",
    "eventStartTime",
    "eventEndTime",
    "eventIsAllDay",
    "eventLocation",
    "eventDescription",
    "includeInTimeline",
    "parentTaskId",
]


async def test_list_tasks(client):
    resp = await client.get("/api/v1/tasks")
    body = resp.json()
    assert len(body) == 4
    for task in body:
        assert_keys(task, TASK_KEYS, "AnalysisTask")
        assert "parentTaskId" in task
    lb = next(t for t in body if t["id"] == seed.TASK_LEADERBOARD)
    # Quirk #8: channelIds items are ChannelRef objects in GET responses.
    assert lb["channelIds"], "leaderboard task must have channels"
    for ref in lb["channelIds"]:
        assert_keys(ref, ["id", "platform", "platformId"], "ChannelRef")
    assert lb["parentTaskId"] is None


async def test_invalid_analysis_time_range_returns_422(client):
    """DB CHECK must not surface as 500 — validate at the API boundary."""
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "bad range",
            "promptTemplate": "x",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "bogus",
            "scheduleType": "seconds_10",
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
            "scheduleType": "hourly",
            "scheduleValue": None,
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
            "scheduleType": "daily",
            "scheduleValue": "08:00",
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
            "scheduleType": "hourly",
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
            "scheduleType": "hourly",
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
                "scheduleType": "hourly",
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
                "scheduleType": "hourly",
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

    monkeypatch.setattr("server.api.routes.tasks.delete_analysis_task", boom)

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

    monkeypatch.setattr("server.api.routes.tasks.delete_analysis_task", boom)

    with pytest.raises(RuntimeError):
        await client.delete(f"/api/v1/tasks/{seed.TASK_LEADERBOARD}")

    assert calls == [
        ("unregister", seed.TASK_LEADERBOARD),
        ("register", seed.TASK_LEADERBOARD),
    ]


def _assert_validation_error(response, expected_message: str) -> None:
    assert response.status_code == 422
    body = response.json()
    assert_keys(body, ["error_code", "message", "details", "correlation_id"], "ValidationError")
    assert body["error_code"] == "VALIDATION_ERROR"
    assert body["message"] == expected_message
    assert body["details"] is None
    assert isinstance(body["correlation_id"], str) and body["correlation_id"]


async def test_non_calendar_create_rejects_supplied_rrule_including_empty(client, app):
    db = app.state.db
    queue = app.state.broadcaster.subscribe()
    before_count = await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks")

    try:
        for name, extra_fields in (
            ("analysis rrule", {"analysisMode": "event", "rrule": "FREQ=DAILY"}),
            ("empty default-mode rrule", {"rrule": ""}),
        ):
            resp = await client.post(
                "/api/v1/tasks",
                json={
                    "name": name,
                    "promptTemplate": "analyse",
                    "channelIds": [],
                    "scheduleType": "hourly",
                    **extra_fields,
                },
            )
            _assert_validation_error(resp, "RRULE is recurring-only and cannot schedule analysis tasks")
    finally:
        app.state.broadcaster.unsubscribe(queue)

    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks") == before_count
    assert queue.empty()


async def test_calendar_invalid_rrule_retains_detail_shape_without_persistence(client, app):
    db = app.state.db
    before_count = await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks")

    for name, rrule, expected_detail in (
        ("empty calendar rrule", "", "Invalid RRULE (empty): RRULE is empty"),
        (
            "bad calendar frequency",
            "FREQ=BOGUS",
            "Invalid RRULE (unsupported_freq): Unsupported FREQ: BOGUS (allowed: DAILY, WEEKLY, MONTHLY, YEARLY)",
        ),
        (
            "sub-day calendar frequency",
            "FREQ=HOURLY",
            "Invalid RRULE (unsupported_freq): Unsupported FREQ: HOURLY (allowed: DAILY, WEEKLY, MONTHLY, YEARLY)",
        ),
        (
            "rrule prefix rejected",
            "RRULE:FREQ=DAILY",
            "RRULE must not include an 'RRULE:' prefix",
        ),
    ):
        resp = await client.post(
            "/api/v1/tasks",
            json={
                "name": name,
                "promptTemplate": "",
                "analysisMode": "recurring",
                "channelIds": [],
                "scheduleType": "seconds_10",
                "rrule": rrule,
            },
        )
        _assert_validation_error(resp, expected_detail)

    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks") == before_count


async def test_calendar_update_validates_against_persisted_mode(client, app):
    db = app.state.db
    task_id = seed.TASK_CALENDAR
    before = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))
    queue = app.state.broadcaster.subscribe()
    try:
        resp = await client.put(
            f"/api/v1/tasks/{task_id}",
            json={
                "name": "must not persist",
                "promptTemplate": "",
                # Omission must resolve to the persisted recurring mode rather than
                # treating this as a default leaderboard update.
                "rrule": "FREQ=BOGUS",
            },
        )
    finally:
        app.state.broadcaster.unsubscribe(queue)

    _assert_validation_error(
        resp,
        "Invalid RRULE (unsupported_freq): Unsupported FREQ: BOGUS (allowed: DAILY, WEEKLY, MONTHLY, YEARLY)",
    )
    assert await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,)) == before
    assert queue.empty()


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
                "scheduleType": "daily",
                "scheduleValue": "08:00",
                "rrule": "FREQ=DAILY",
            },
        )
    finally:
        app.state.broadcaster.unsubscribe(queue)

    _assert_validation_error(resp, "RRULE is recurring-only and cannot schedule analysis tasks")
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


async def test_chat_assistant_contract(client):
    empty = await client.post("/api/v1/tasks/chat-assistant", json={"messages": []})
    assert empty.status_code == 200
    empty_body = empty.json()
    assert_keys(empty_body, ["message", "taskConfig"], "ChatAssistantResponse (empty)")
    assert empty_body["taskConfig"] is None

    assistant_only = await client.post(
        "/api/v1/tasks/chat-assistant",
        json={"messages": [{"role": "assistant", "content": "hello"}]},
    )
    assert assistant_only.status_code == 200
    assert_keys(assistant_only.json(), ["message", "taskConfig"], "ChatAssistantResponse (no user)")

    resp = await client.post(
        "/api/v1/tasks/chat-assistant",
        json={"messages": [{"role": "user", "content": "幫我建立一個監控任務"}]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["message", "taskConfig"], "ChatAssistantResponse")
    assert isinstance(body["message"], str)
    assert body["message"]
    assert body["taskConfig"] is None or isinstance(body["taskConfig"], dict)


async def test_activity_spans(client):
    resp = await client.get("/api/v1/tasks/activity-spans")
    body = resp.json()
    assert len(body) == 4
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
            ],
            "TaskActivitySpan",
        )
    lb = next(s for s in body if s["taskId"] == seed.TASK_LEADERBOARD)
    assert lb["completedBatchCount"] == 1


async def test_activity_spans_include_virtual_user_events_source(client):
    created = await client.post(
        "/api/v1/user-events",
        json={
            "title": "手動排程",
            "startTime": "2026-07-21T09:00:00Z",
            "endTime": "2026-07-21T11:00:00Z",
        },
    )
    assert created.status_code == 201

    spans = (await client.get("/api/v1/tasks/activity-spans")).json()
    user_span = next(span for span in spans if span["taskId"] == "__user__")
    assert user_span["taskName"] == "用戶或助手"
    assert user_span["earliestBatchStart"] == "2026-07-21T09:00:00Z"
    assert user_span["latestBatchEnd"] == "2026-07-21T11:00:00Z"
    assert user_span["completedBatchCount"] == 1


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
            "scheduleType": "seconds_10",
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
            schedule_type="hourly",
            schedule_value=None,
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

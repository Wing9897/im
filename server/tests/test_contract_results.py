"""Contract keys: results routes (trending / events / calendar / queue / stats)."""

from __future__ import annotations

from datetime import datetime, timezone

from server.api.schemas.responses import AnalysisEventResponse, TrendingTopicResponse
from server.calendar import rrule as calendar_module
from server.tests import seed
from server.tests.contract_helpers import MESSAGE_KEYS, assert_keys
from server.util import new_id, utc_now_iso


async def test_trending(client):
    resp = await client.get("/api/v1/results/trending")
    body = resp.json()
    assert len(body) == 2
    for topic in body:
        assert set(topic) == set(TrendingTopicResponse.model_fields)
        assert_keys(
            topic,
            ["id", "taskId", "taskName", "rank", "topicName", "score", "summary", "createdAt"],
            "TrendingTopic",
        )
        # Quirk #10: .toFixed(1) is called on score without guards.
        assert isinstance(topic["score"], (int, float))
        assert topic["rank"] is not None
        assert 1 <= int(topic["rank"]) <= 10

    filtered = await client.get("/api/v1/results/trending", params={"task_id": seed.TASK_LEADERBOARD})
    filtered_body = filtered.json()
    assert len(filtered_body) == 2
    assert all(1 <= int(t["rank"]) <= 10 for t in filtered_body)


async def test_trending_topic_messages(client):
    resp = await client.get(f"/api/v1/results/trending/{seed.TOPIC_1}/messages")
    body = resp.json()
    assert len(body) == 1
    assert_keys(body[0], MESSAGE_KEYS, "topic Message")


async def _insert_event(
    db,
    *,
    event_id: str,
    title: str,
    body: str,
    content_hash: str,
    semantic_hash: str,
    location: str,
    source_message_id: str | None,
    channel_names: str | None,
    latitude: float | None,
    longitude: float | None,
    created_at: str,
    start_time: str | None = None,
    end_time: str | None = None,
    event_key: str | None = None,
    participants_json: str = "[]",
    task_id: str = seed.TASK_EVENT,
    batch_id: str = seed.BATCH_EVENT,
) -> None:
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "start_time, end_time, location, latitude, longitude, participants_json, "
        "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
        "event_key, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            task_id,
            batch_id,
            title,
            body,
            start_time,
            end_time,
            location,
            latitude,
            longitude,
            participants_json,
            source_message_id,
            channel_names,
            content_hash,
            semantic_hash,
            event_key,
            created_at,
            created_at,
        ),
    )


async def test_events(client):
    resp = await client.get("/api/v1/results/events", params={"limit": "50", "offset": "0"})
    body = resp.json()
    assert_keys(body, ["items", "hasMore", "totalCount", "sort"], "events envelope")
    assert len(body["items"]) >= 1
    item = body["items"][0]
    assert set(item) == set(AnalysisEventResponse.model_fields)
    assert_keys(
        item,
        [
            "id",
            "title",
            "body",
            "startTime",
            "endTime",
            "location",
            "createdAt",
            "updatedAt",
            "taskName",
            "latitude",
            "longitude",
            "participants",
        ],
        "AnalysisEvent",
    )


async def test_events_untimed_list(client):
    resp = await client.get(
        "/api/v1/results/events",
        params={"has_time": "0", "limit": "50", "offset": "0"},
    )
    body = resp.json()
    assert_keys(body, ["items", "hasMore", "totalCount", "sort"], "events envelope")
    assert len(body["items"]) >= 1
    item = next(i for i in body["items"] if i["id"] == "ben-1")
    assert_keys(
        item,
        [
            "id",
            "title",
            "body",
            "location",
            "createdAt",
            "taskName",
            "sourceMessageTime",
            "sourcePlatform",
            "sourceChannelName",
            "analysisTimeRange",
            "batchSourceChannelNames",
            "latitude",
            "longitude",
        ],
        "AnalysisEvent",
    )
    assert isinstance(item["batchSourceChannelNames"], list)
    assert item["sourceChannelName"] == "TG News Channel"

    searched = await client.get(
        "/api/v1/results/events",
        params={"search": "演唱會", "has_time": "0", "limit": "50", "offset": "0"},
    )
    assert len(searched.json()["items"]) == 1
    empty = await client.get(
        "/api/v1/results/events",
        params={"search": "不存在的字串", "has_time": "0", "limit": "50", "offset": "0"},
    )
    assert empty.json()["items"] == []


async def test_events_sort_by_source_message_time(app, client):
    """Event time (message timestamp) wins over row created_at for ordering."""
    db = app.state.db
    await _insert_event(
        db,
        event_id="ben-newer-event",
        title="較新事件",
        body="依訊息時間較新",
        content_hash="hash-2",
        semantic_hash="sem-2",
        location="尖沙咀",
        source_message_id="msg-2",
        channel_names='["TG News Channel"]',
        latitude=22.30,
        longitude=114.17,
        created_at="2026-07-01T11:00:00+00:00",
    )
    await _insert_event(
        db,
        event_id="ben-older-event",
        title="較舊事件",
        body="依訊息時間較舊",
        content_hash="hash-3",
        semantic_hash="sem-3",
        location="銅鑼灣",
        source_message_id=seed.MESSAGE_1,
        channel_names='["TG News Channel"]',
        latitude=22.28,
        longitude=114.18,
        created_at="2026-07-01T15:00:00+00:00",
    )

    resp = await client.get(
        "/api/v1/results/events",
        params={"has_time": "0", "limit": "50", "offset": "0"},
    )
    ids = [item["id"] for item in resp.json()["items"]]

    assert ids.index("ben-newer-event") < ids.index("ben-older-event")


async def test_events_sort_by_analyzed_at(app, client):
    """analyzed_at sort uses row created_at, not source message timestamp."""
    db = app.state.db
    await _insert_event(
        db,
        event_id="ben-analyzed-later",
        title="後分析",
        body="較晚寫入",
        content_hash="hash-late",
        semantic_hash="sem-late",
        location="尖沙咀",
        source_message_id=seed.MESSAGE_1,
        channel_names='["TG News Channel"]',
        latitude=22.30,
        longitude=114.17,
        created_at="2026-07-01T18:00:00+00:00",
    )
    await _insert_event(
        db,
        event_id="ben-analyzed-earlier",
        title="先分析",
        body="較早寫入",
        content_hash="hash-early",
        semantic_hash="sem-early",
        location="銅鑼灣",
        source_message_id="msg-2",
        channel_names='["TG News Channel"]',
        latitude=22.28,
        longitude=114.18,
        created_at="2026-07-01T10:00:00+00:00",
    )

    resp = await client.get(
        "/api/v1/results/events",
        params={"has_time": "0", "limit": "50", "offset": "0", "sort": "analyzed_at"},
    )
    body = resp.json()
    assert body["sort"] == "analyzed_at"
    ids = [item["id"] for item in body["items"]]
    assert ids.index("ben-analyzed-later") < ids.index("ben-analyzed-earlier")


async def test_events_invalid_sort_returns_422(client):
    resp = await client.get("/api/v1/results/events", params={"sort": "newest"})
    assert resp.status_code == 422


async def test_events_date_filter(app, client):
    """start_date/end_date filter on event time (message timestamp)."""
    db = app.state.db
    await _insert_event(
        db,
        event_id="ben-in-range",
        title="範圍內",
        body="在範圍",
        content_hash="hash-in",
        semantic_hash="sem-in",
        location="中環",
        source_message_id="msg-2",
        channel_names='["TG News Channel"]',
        latitude=22.28,
        longitude=114.15,
        created_at="2026-07-01T12:00:00+00:00",
    )
    await _insert_event(
        db,
        event_id="ben-out-range",
        title="範圍外",
        body="在範圍外",
        content_hash="hash-out",
        semantic_hash="sem-out",
        location="離島",
        source_message_id=None,
        channel_names='["TG News Channel"]',
        latitude=22.20,
        longitude=114.10,
        created_at="2026-06-01T12:00:00+00:00",
    )

    resp = await client.get(
        "/api/v1/results/events",
        params={
            "has_time": "0",
            "start_date": "2026-07-01T00:00:00Z",
            "end_date": "2026-07-31T23:59:59Z",
            "limit": "50",
            "offset": "0",
        },
    )
    ids = {item["id"] for item in resp.json()["items"]}
    assert "ben-in-range" in ids
    assert "ben-out-range" not in ids


async def test_events_timed_list(client):
    resp = await client.get("/api/v1/results/events", params={"has_time": "1"})
    body = resp.json()
    assert_keys(body, ["items", "hasMore", "totalCount", "sort"], "events envelope")
    assert len(body["items"]) >= 1
    event = next(item for item in body["items"] if item["id"] == "ev-1")
    assert_keys(
        event,
        ["id", "title", "body", "startTime", "endTime", "location", "participants", "taskName"],
        "AnalysisEvent",
    )
    assert event["body"] == "Q3 檢討"
    assert event["participants"] == ["Alice", "Bob"]


async def test_events_has_time_filter(client):
    timed = await client.get("/api/v1/results/events", params={"has_time": "1", "limit": "50"})
    assert all(item["startTime"] for item in timed.json()["items"])
    untimed = await client.get("/api/v1/results/events", params={"has_time": "0", "limit": "50"})
    assert all(not item["startTime"] for item in untimed.json()["items"])


async def test_calendar_occurrences(client):
    resp = await client.get(
        "/api/v1/calendar/items",
        params={
            "range_start": "2026-07-01T00:00:00Z",
            "range_end": "2026-07-31T23:59:59Z",
            "include_items": "false",
        },
    )
    body = resp.json()
    # Weekly Monday rule → 4 Mondays in July 2026 window (6,13,20,27).
    assert len(body) == 4
    expected_keys = {
        "id",
        "taskId",
        "taskName",
        "title",
        "startTime",
        "endTime",
        "isAllDay",
        "timezone",
        "location",
        "description",
        "rrule",
        "dismissed",
        "source",
        "worksetId",
        "itemId",
        "itemDateKind",
    }
    for occurrence in body:
        assert set(occurrence) == expected_keys
        assert occurrence["source"] == "recurring"
    assert body[0]["startTime"] == "2026-07-06T10:00:00Z"


async def test_calendar_includes_endpoints_and_skips_invalid_or_inactive_persisted_tasks(app, client, caplog):
    """Persisted bad/inactive calendar rows stay isolated from inclusive expansion.

    **Validates: Requirements 1.4, 1.5, 1.6**
    """
    now = "2026-07-01T00:00:00+00:00"
    fixtures = (
        ("calendar-invalid-persisted", 1, "FREQ=NOTREAL"),
        ("calendar-inactive", 0, "FREQ=DAILY"),
    )
    for task_id, is_active, rrule in fixtures:
        await app.state.db.execute(
            "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, analysis_time_range, "
            "version, is_active, schedule_rrule, created_at, updated_at) "
            "VALUES (?, ?, 'Analyze', 'recurring', 'all', 1, ?, NULL, ?, ?)",
            (task_id, task_id, is_active, now, now),
        )
        await app.state.db.execute(
            "INSERT INTO recurring_schedules "
            "(task_id, rrule, dtstart, dtend, timezone, created_at, updated_at) "
            "VALUES (?, ?, '2000-01-01T10:00:00', '2000-01-01T11:00:00', 'floating', ?, ?)",
            (task_id, rrule, now, now),
        )

    response = await client.get(
        "/api/v1/calendar/items",
        params={
            "range_start": "2026-07-06T10:00:00Z",
            "range_end": "2026-07-13T10:00:00Z",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert [(item["taskId"], item["startTime"]) for item in body] == [
        (seed.TASK_CALENDAR, "2026-07-06T10:00:00Z"),
        (seed.TASK_CALENDAR, "2026-07-13T10:00:00Z"),
    ]
    assert "Skipping recurring task calendar-invalid-persisted" in caplog.text
    assert all(item["taskId"] != "calendar-inactive" for item in body)


async def test_calendar_persisted_mixture_preserves_allocation_contract_and_final_order(app, client, caplog):
    """The persisted API path preserves skip, budget, boundary, and wire contracts.

    **Validates: Requirements 2.7, 3.5, 3.6, 3.7, 3.9**
    """
    # Task-form ``HH:MM`` clocks are system-local wall time, so the requested
    # window and the expected wire instants are derived from the host timezone.
    local_tz = calendar_module._system_tzinfo()

    def utc_at(day: int, hour: int) -> datetime:
        local = datetime(2000, 1, day, hour, 0, tzinfo=local_tz)
        return local.astimezone(timezone.utc)

    def wire(moment: datetime) -> str:
        return moment.strftime("%Y-%m-%dT%H:%M:%SZ")

    def occurrence_id(task_id: str, moment: datetime) -> str:
        return f"{task_id}:{moment.strftime('%Y%m%dT%H%M%SZ')}"

    day1_start, day1_end = utc_at(1, 10), utc_at(1, 11)
    day2_start, day2_end = utc_at(2, 10), utc_at(2, 11)

    db = app.state.db
    now = "2026-07-01T00:00:00+00:00"
    await db.execute("DELETE FROM analysis_tasks WHERE analysis_mode = 'recurring'")

    fixtures = (
        (
            "z-calendar-boundary",
            "Boundary owner",
            1,
            "FREQ=DAILY",
            "10:00",
            "11:00",
            "Room Z",
            "Inclusive endpoints",
        ),
        ("calendar-invalid", "Invalid", 1, "FREQ=NOTREAL", "10:00", "11:00", None, None),
        ("calendar-inactive", "Inactive", 0, "FREQ=SECONDLY", "10:00", "11:00", None, None),
        ("calendar-no-rule", "No rule", 1, None, "10:00", "11:00", None, None),
        ("a-calendar-dense", "Dense follower", 1, "FREQ=SECONDLY", "10:00", None, None, None),
        ("calendar-after-budget", "After budget", 1, "FREQ=DAILY", "10:00", "11:00", None, None),
    )
    for task_id, name, is_active, rrule, start_time, end_time, location, description in fixtures:
        await db.execute(
            "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, analysis_time_range, "
            "version, is_active, schedule_rrule, created_at, updated_at) "
            "VALUES (?, ?, 'Analyze', 'recurring', 'all', 1, ?, NULL, ?, ?)",
            (
                task_id,
                name,
                is_active,
                now,
                now,
            ),
        )
        if rrule is not None:
            await db.execute(
                "INSERT INTO recurring_schedules "
                "(task_id, rrule, dtstart, dtend, location, description, timezone, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, 'floating', ?, ?)",
                (
                    task_id,
                    rrule,
                    f"2000-01-01T{start_time}:00",
                    f"2000-01-01T{end_time}:00" if end_time else None,
                    location,
                    description,
                    now,
                    now,
                ),
            )

    response = await client.get(
        "/api/v1/calendar/items",
        params={
            "range_start": wire(day1_start),
            "range_end": wire(day2_start),
            "include_items": "false",
        },
    )

    assert response.status_code == 200
    body = response.json()
    occurrence_keys = {
        "id",
        "taskId",
        "taskName",
        "title",
        "startTime",
        "endTime",
        "isAllDay",
        "timezone",
        "location",
        "description",
        "rrule",
        "dismissed",
        "source",
        "worksetId",
        "itemId",
        "itemDateKind",
    }
    assert len(body) == 1000
    assert all(set(item) == occurrence_keys for item in body)
    assert [(item["startTime"], item["taskId"]) for item in body] == sorted(
        (item["startTime"], item["taskId"]) for item in body
    )

    by_task: dict[str, list[dict]] = {}
    for item in body:
        by_task.setdefault(item["taskId"], []).append(item)
    assert set(by_task) == {"z-calendar-boundary", "a-calendar-dense"}
    assert len(by_task["z-calendar-boundary"]) == 2
    assert len(by_task["a-calendar-dense"]) == 998
    assert [item["startTime"] for item in by_task["z-calendar-boundary"]] == [
        wire(day1_start),
        wire(day2_start),
    ]

    assert body[0] == {
        "id": occurrence_id("a-calendar-dense", day1_start),
        "taskId": "a-calendar-dense",
        "taskName": "Dense follower",
        "title": "Dense follower",
        "startTime": wire(day1_start),
        "endTime": wire(day1_start),
        "isAllDay": False,
        "timezone": None,
        "location": None,
        "description": None,
        "rrule": "FREQ=SECONDLY",
        "dismissed": False,
        "source": "recurring",
        "worksetId": None,
        "itemId": None,
        "itemDateKind": None,
    }
    assert by_task["z-calendar-boundary"][0] == {
        "id": occurrence_id("z-calendar-boundary", day1_start),
        "taskId": "z-calendar-boundary",
        "taskName": "Boundary owner",
        "title": "Boundary owner",
        "startTime": wire(day1_start),
        "endTime": wire(day1_end),
        "isAllDay": False,
        "timezone": None,
        "location": "Room Z",
        "description": "Inclusive endpoints",
        "rrule": "FREQ=DAILY",
        "dismissed": False,
        "source": "recurring",
        "worksetId": None,
        "itemId": None,
        "itemDateKind": None,
    }
    assert body[-1] == {
        **by_task["z-calendar-boundary"][0],
        "id": occurrence_id("z-calendar-boundary", day2_start),
        "startTime": wire(day2_start),
        "endTime": wire(day2_end),
    }
    assert "Skipping recurring task calendar-invalid" in caplog.text


async def test_queue(client):
    resp = await client.get("/api/v1/results/queue")
    body = resp.json()
    assert_keys(
        body,
        ["analysisPaused", "processingBatches", "attentionBatches", "pendingCount"],
        "queue",
    )
    assert isinstance(body["analysisPaused"], bool)
    assert isinstance(body["processingBatches"], list)
    assert isinstance(body["attentionBatches"], list)


async def test_queue_attention_batches_include_error_message(app, client):
    db = app.state.db
    now = utc_now_iso()
    batch_id = new_id()
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, "
        "retry_count, error_message, prompt_tokens, completion_tokens, created_at, updated_at) "
        "VALUES (?, ?, 1, 'pending', 2, 1, ?, 10, 5, ?, ?)",
        (batch_id, seed.TASK_LEADERBOARD, "LLM timeout", now, now),
    )

    body = (await client.get("/api/v1/results/queue")).json()
    attention = {row["batchId"]: row for row in body["attentionBatches"]}
    assert batch_id in attention
    assert attention[batch_id]["errorMessage"] == "LLM timeout"
    assert attention[batch_id]["retryCount"] == 1
    assert attention[batch_id]["promptTokens"] == 10
    assert attention[batch_id]["completionTokens"] == 5


async def test_stats(client):
    resp = await client.get("/api/v1/results/stats", params={"time_range": "all"})
    body = resp.json()
    assert len(body) == 6
    for entry in body:
        assert_keys(
            entry,
            [
                "taskId",
                "unanalyzedCount",
                "analyzedCount",
                "queuedMessageCount",
            ],
            "TaskAnalysisStats",
        )

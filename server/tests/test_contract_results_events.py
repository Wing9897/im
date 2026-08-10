"""Contract keys: results events list / filters / sort."""

from __future__ import annotations

from server.api.schemas.responses import AnalysisEventResponse
from server.tests import seed
from server.tests.contract_helpers import assert_keys
from server.tests.contract_results_helpers import insert_event


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
        params={"hasTime": "0", "limit": "50", "offset": "0"},
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
        params={"search": "演唱會", "hasTime": "0", "limit": "50", "offset": "0"},
    )
    assert len(searched.json()["items"]) == 1
    empty = await client.get(
        "/api/v1/results/events",
        params={"search": "不存在的字串", "hasTime": "0", "limit": "50", "offset": "0"},
    )
    assert empty.json()["items"] == []


async def test_events_sort_by_source_message_time(app, client):
    """Event time (message timestamp) wins over row created_at for ordering."""
    db = app.state.db
    await insert_event(
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
    await insert_event(
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
        params={"hasTime": "0", "limit": "50", "offset": "0"},
    )
    ids = [item["id"] for item in resp.json()["items"]]

    assert ids.index("ben-newer-event") < ids.index("ben-older-event")


async def test_events_sort_by_analyzed_at(app, client):
    """analyzed_at sort uses row created_at, not source message timestamp."""
    db = app.state.db
    await insert_event(
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
    await insert_event(
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
        params={"hasTime": "0", "limit": "50", "offset": "0", "sort": "analyzed_at"},
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
    await insert_event(
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
    await insert_event(
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
            "hasTime": "0",
            "startDate": "2026-07-01T00:00:00Z",
            "endDate": "2026-07-31T23:59:59Z",
            "limit": "50",
            "offset": "0",
        },
    )
    ids = {item["id"] for item in resp.json()["items"]}
    assert "ben-in-range" in ids
    assert "ben-out-range" not in ids


async def test_events_timed_list(client):
    resp = await client.get("/api/v1/results/events", params={"hasTime": "1"})
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
    timed = await client.get("/api/v1/results/events", params={"hasTime": "1", "limit": "50"})
    assert all(item["startTime"] for item in timed.json()["items"])
    untimed = await client.get("/api/v1/results/events", params={"hasTime": "0", "limit": "50"})
    assert all(not item["startTime"] for item in untimed.json()["items"])

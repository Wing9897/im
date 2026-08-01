"""SSE contract: the 8 named event types and {type, payload} wire envelope."""

from __future__ import annotations

import asyncio
import json
from typing import cast

import pytest
from fastapi import Request

from server.api.routes.events import events
from server.sse import _MAX_SUBSCRIBERS, EVENT_TYPES, SseBroadcaster, SseCapacityError

FRONTEND_EVENT_TYPES = {
    "messages_updated",
    "collector_status_changed",
    "account_status_changed",
    "analysis_started",
    "analysis_completed",
    "analysis_failed",
    "analysis_paused_changed",
    "resource_modified",
}


class _StreamRequest:
    """Minimal stand-in: the route only reads app.state and hands the request to
    the stream generator, which never runs in these tests."""

    def __init__(self, app) -> None:
        self.app = app


def _stream_request(app) -> Request:
    return cast(Request, _StreamRequest(app))


def test_event_types_cover_frontend_listeners():
    assert FRONTEND_EVENT_TYPES.issubset(set(EVENT_TYPES))


async def test_subscribe_refuses_to_exceed_the_cap():
    broadcaster = SseBroadcaster()
    queues = [broadcaster.subscribe() for _ in range(_MAX_SUBSCRIBERS)]
    try:
        with pytest.raises(SseCapacityError):
            broadcaster.subscribe()
        assert broadcaster.subscriber_count() == _MAX_SUBSCRIBERS
    finally:
        for queue in queues:
            broadcaster.unsubscribe(queue)


async def test_events_route_takes_its_slot_before_streaming(app):
    """The route admits the subscriber itself, so the cap cannot be overshot.

    Subscribing lazily inside the stream generator meant concurrent requests all
    passed the capacity check while none of them had taken a slot yet.
    """
    broadcaster = app.state.broadcaster
    before = broadcaster.subscriber_count()
    await events(_stream_request(app))
    assert broadcaster.subscriber_count() == before + 1


async def test_concurrent_events_requests_never_exceed_the_cap(app):
    broadcaster = app.state.broadcaster
    results = await asyncio.gather(
        *(events(_stream_request(app)) for _ in range(_MAX_SUBSCRIBERS + 5)),
        return_exceptions=True,
    )
    admitted = [r for r in results if not isinstance(r, BaseException)]
    rejected = [r for r in results if isinstance(r, BaseException)]
    assert len(admitted) == _MAX_SUBSCRIBERS
    assert broadcaster.subscriber_count() == _MAX_SUBSCRIBERS
    assert all(getattr(exc, "status_code", None) == 503 for exc in rejected)


async def test_broadcast_envelope_shape():
    broadcaster = SseBroadcaster()
    queue = broadcaster.subscribe()
    try:
        broadcaster.publish(
            "analysis_started",
            {"taskId": "t1", "batchId": "b1", "messageCount": 5},
        )
        event = queue.get_nowait()
    finally:
        broadcaster.unsubscribe(queue)

    assert event["event"] == "analysis_started"
    data = json.loads(event["data"])
    # sseClient.ts extracts .payload when the key exists.
    assert data["type"] == "analysis_started"
    assert data["payload"]["taskId"] == "t1"
    assert data["payload"]["batchId"] == "b1"


async def test_collector_status_payload_shape():
    """Aggregate collector_status_changed uses snake_case optional adapter fields."""
    broadcaster = SseBroadcaster()
    queue = broadcaster.subscribe()
    try:
        broadcaster.publish(
            "collector_status_changed",
            {"status": "running"},
        )
        event = queue.get_nowait()
    finally:
        broadcaster.unsubscribe(queue)
    payload = json.loads(event["data"])["payload"]
    assert payload["status"] in {"running", "stopped", "error", "starting", "stopping", "restarting"}


@pytest.mark.parametrize(
    ("event_type", "payload"),
    [
        (
            "analysis_paused_changed",
            {
                "analysisPaused": True,
                "reason": "batch_retries_exhausted",
                "taskId": "task-1",
                "taskName": "Task 1",
                "batchId": "batch-1",
            },
        ),
        (
            "account_status_changed",
            {"accountId": "account-1", "status": "connecting", "lastError": "retrying"},
        ),
    ],
)
async def test_edge_payload_contracts(event_type, payload):
    broadcaster = SseBroadcaster()
    queue = broadcaster.subscribe()
    try:
        broadcaster.publish(event_type, payload)
        event = queue.get_nowait()
    finally:
        broadcaster.unsubscribe(queue)

    assert event["event"] == event_type
    assert json.loads(event["data"])["payload"] == payload


async def test_user_event_crud_publishes_resource_modified(client, app):
    broadcaster = app.state.broadcaster
    queue = broadcaster.subscribe()
    try:
        created = await client.post(
            "/api/v1/calendar/user-events",
            json={"title": "SSE 測試", "startTime": "2026-07-21T09:00:00Z"},
        )
        event_id = created.json()["id"]
        patched = await client.patch(
            f"/api/v1/calendar/user-events/{event_id}",
            json={"title": "SSE 測試（改）"},
        )
        deleted = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
        events = [queue.get_nowait() for _ in range(3)]
    finally:
        broadcaster.unsubscribe(queue)

    assert created.status_code == 201
    assert patched.status_code == 200
    assert deleted.status_code == 204
    payloads = [json.loads(event["data"])["payload"] for event in events]
    assert payloads == [
        {"resourceType": "user_event", "resourceId": event_id, "action": "created"},
        {"resourceType": "user_event", "resourceId": event_id, "action": "updated"},
        {"resourceType": "user_event", "resourceId": event_id, "action": "deleted"},
    ]
    assert all(event["event"] == "resource_modified" for event in events)

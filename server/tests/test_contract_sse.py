"""SSE contract: the 8 named event types, {type, payload} wire envelope, and
payload-schema drift guards (OpenAPI components in ``responses/sse.py``).

Three copies stay separate on purpose (desktop cannot import web OpenAPI):
server Pydantic, web generated ``Sse*Payload`` types, and
``desktop/sse-payloads.ts`` field tuples. Expand coverage here and in the
desktop drift test — do not merge the sources.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, cast, get_args

import pytest
from fastapi import Request
from pydantic import BaseModel

from server.api.routes.events import events
from server.api.schemas.responses.sse import (
    SseAnalysisCompletedPayload,
    SseAnalysisFailedPayload,
    SseAnalysisPausedChangedPayload,
    SseAnalysisStartedPayload,
    SseCollectorStatusChangedPayload,
    SseEventEnvelope,
    SseEventType,
    SseMessagesUpdatedPayload,
    SseResourceModifiedPayload,
    SseSourceStatusChangedPayload,
)
from server.sse import _MAX_SUBSCRIBERS, EVENT_TYPES, SseBroadcaster, SseCapacityError, event_stream
from server.wire.serializers import serialize_message

FRONTEND_EVENT_TYPES = {
    "messages_updated",
    "collector_status_changed",
    "source_status_changed",
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


async def test_stream_disconnect_releases_subscriber_slot():
    class DisconnectedRequest:
        async def is_disconnected(self) -> bool:
            return True

    broadcaster = SseBroadcaster()
    queue = broadcaster.subscribe()
    response = event_stream(broadcaster, cast(Request, DisconnectedRequest()), queue)

    body_iterator = cast(Any, response.body_iterator)
    with pytest.raises(StopAsyncIteration):
        await anext(body_iterator)

    assert broadcaster.subscriber_count() == 0


async def test_collector_status_payload_shape():
    """Aggregate collector_status_changed uses camelCase optional adapter fields."""
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
    assert payload["status"] in {"running", "stopped", "error"}


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
            "source_status_changed",
            {"sourceId": "source-1", "status": "connecting", "lastError": "retrying"},
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


# ── payload schema drift guards ──────────────────────────────────────────────


def _serialized_message() -> dict[str, Any]:
    return serialize_message(
        {
            "id": "message-1",
            "source_id": "account-1",
            "platform": "telegram",
            "platform_id": "channel-1",
            "channel_name": "Announcements",
            "platform_message_id": "42",
            "sender_id": "user-1",
            "sender_name": "Alice",
            "content": "Hello",
            "timestamp": "2026-07-28T09:00:00Z",
            "raw_data": None,
            "created_at": "2026-07-28T09:00:01Z",
        }
    )


#: One entry per publish-site variant; models use extra="forbid", so a field
#: added at a publish site without a schema update fails here.
_PUBLISH_SITE_PAYLOADS: tuple[tuple[str, type[BaseModel], dict[str, Any]], ...] = (
    # collector/base.py _insert_message / routes/messages.py
    ("messages_updated", SseMessagesUpdatedPayload, {"messages": [_serialized_message()]}),
    # collector/manager.py shutdown + _publish_aggregate_collector_status
    ("collector_status_changed", SseCollectorStatusChangedPayload, {"status": "stopped"}),
    (
        "collector_status_changed",
        SseCollectorStatusChangedPayload,
        {"status": "error", "adapterName": "rss:feed-1", "errorSummary": "boom", "correlation_id": "abc123"},
    ),
    # collector/base.py _broadcast_status_change (incl. transient reconnect)
    ("source_status_changed", SseSourceStatusChangedPayload, {"sourceId": "source-1", "status": "connected"}),
    (
        "source_status_changed",
        SseSourceStatusChangedPayload,
        {"sourceId": "source-1", "status": "connecting", "lastError": "retrying"},
    ),
    # scheduler/batch_process.py
    (
        "analysis_started",
        SseAnalysisStartedPayload,
        {
            "taskId": "task-1",
            "taskName": "Task 1",
            "batchId": "batch-1",
            "messageCount": 5,
            "estimatedTokens": 1200,
            "llmProvider": "ollama",
            "llmModel": "llama3",
        },
    ),
    # scheduler/agent_tick_schedule.py
    (
        "analysis_started",
        SseAnalysisStartedPayload,
        {
            "taskId": "task-1",
            "taskName": "Task 1",
            "batchId": "batch-1",
            "messageCount": 0,
            "estimatedTokens": 0,
            "llmProvider": "ollama",
            "llmModel": "llama3",
            "webSearchMode": "brave",
            "analysisMode": "agent",
        },
    ),
    # scheduler/batch_process.py (message-batch completion with overlap stats)
    (
        "analysis_completed",
        SseAnalysisCompletedPayload,
        {
            "taskId": "task-1",
            "batchId": "batch-1",
            "analysisMode": "intel_event",
            "findingsCount": 3,
            "hasFindings": True,
            "overlapStatistics": {
                "overlapUsedCount": 2,
                "overlapTrimmedCount": 0,
                "overlapTokens": 100,
                "primaryTokens": 900,
                "totalTokens": 1000,
            },
        },
    ),
    # scheduler/agent_tick_schedule.py (agent tick completion)
    (
        "analysis_completed",
        SseAnalysisCompletedPayload,
        {
            "taskId": "task-1",
            "batchId": "batch-1",
            "analysisMode": "agent",
            "findingsCount": 0,
            "hasFindings": False,
            "webSearchMode": "agent:brave",
            "messageCount": 4,
        },
    ),
    # scheduler/agent_batches.py (skipped tick)
    (
        "analysis_completed",
        SseAnalysisCompletedPayload,
        {
            "taskId": "task-1",
            "batchId": "batch-1",
            "analysisMode": "agent",
            "findingsCount": 0,
            "hasFindings": False,
            "skipped": True,
            "skipReason": "skipped: no messages",
        },
    ),
    # scheduler/batch_failure.py (retry-in-place)
    (
        "analysis_failed",
        SseAnalysisFailedPayload,
        {
            "taskId": "task-1",
            "taskName": "Task 1",
            "batchId": "batch-1",
            "error": "LLM timeout",
            "retrying": True,
            "currentRetry": 1,
            "maxRetries": 3,
            "retriesExhausted": False,
        },
    ),
    # scheduler/agent_batches.py complete_agent_failure
    (
        "analysis_failed",
        SseAnalysisFailedPayload,
        {
            "taskId": "task-1",
            "taskName": "Task 1",
            "batchId": "batch-1",
            "error": "boom",
            "analysisMode": "agent",
            "retrying": False,
            "currentRetry": 3,
            "maxRetries": 3,
            "retriesExhausted": True,
            "taskDeactivated": True,
        },
    ),
    # scheduler/batch_failure.py auto-pause
    (
        "analysis_paused_changed",
        SseAnalysisPausedChangedPayload,
        {
            "analysisPaused": True,
            "reason": "batch_retries_exhausted",
            "taskId": "task-1",
            "taskName": "Task 1",
            "batchId": "batch-1",
        },
    ),
    # server/sse.py publish_resource_modified (user_event CRUD)
    (
        "resource_modified",
        SseResourceModifiedPayload,
        {"resourceType": "user_event", "resourceId": "event-1", "action": "created"},
    ),
    # collector/manager.py _publish_aggregate_collector_status (healthy)
    ("collector_status_changed", SseCollectorStatusChangedPayload, {"status": "running"}),
    # collector/base.py _broadcast_status_change (disconnect / error)
    (
        "source_status_changed",
        SseSourceStatusChangedPayload,
        {"sourceId": "source-1", "status": "disconnected"},
    ),
    (
        "source_status_changed",
        SseSourceStatusChangedPayload,
        {"sourceId": "source-1", "status": "error", "lastError": "auth failed"},
    ),
    # routes/tasks, items, actions, worksets, llm, calendar/recurring
    (
        "resource_modified",
        SseResourceModifiedPayload,
        {"resourceType": "task", "resourceId": "task-1", "action": "updated"},
    ),
    (
        "resource_modified",
        SseResourceModifiedPayload,
        {"resourceType": "item", "resourceId": "item-1", "action": "deleted"},
    ),
    (
        "resource_modified",
        SseResourceModifiedPayload,
        {"resourceType": "action", "resourceId": "action-1", "action": "created"},
    ),
    (
        "resource_modified",
        SseResourceModifiedPayload,
        {"resourceType": "workset", "resourceId": "ws-1", "action": "updated"},
    ),
    (
        "resource_modified",
        SseResourceModifiedPayload,
        {"resourceType": "llm_profile", "resourceId": "llm-1", "action": "created"},
    ),
    (
        "resource_modified",
        SseResourceModifiedPayload,
        {"resourceType": "recurring", "resourceId": "rr-1", "action": "deleted"},
    ),
)


def test_event_type_literal_matches_broadcaster_vocabulary():
    assert get_args(SseEventType) == EVENT_TYPES


def test_publish_sites_cover_every_payload_model():
    covered = {model for _, model, _ in _PUBLISH_SITE_PAYLOADS}
    expected = {
        SseMessagesUpdatedPayload,
        SseCollectorStatusChangedPayload,
        SseSourceStatusChangedPayload,
        SseAnalysisStartedPayload,
        SseAnalysisCompletedPayload,
        SseAnalysisFailedPayload,
        SseAnalysisPausedChangedPayload,
        SseResourceModifiedPayload,
    }
    assert covered == expected


@pytest.mark.parametrize(
    ("event_type", "model", "payload"),
    _PUBLISH_SITE_PAYLOADS,
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_publish_site_payloads_match_schema(event_type, model, payload):
    validated = model.model_validate(payload)
    assert validated.model_dump(exclude_unset=True) == payload

    envelope = SseEventEnvelope.model_validate({"type": event_type, "payload": payload})
    assert envelope.type == event_type


async def test_openapi_exports_sse_and_action_config_components(app):
    schema = cast(Any, app).openapi()
    components = schema["components"]["schemas"]
    expected = {
        "SseEventEnvelope",
        "SseMessagesUpdatedPayload",
        "SseCollectorStatusChangedPayload",
        "SseSourceStatusChangedPayload",
        "SseAnalysisStartedPayload",
        "SseAnalysisCompletedPayload",
        "SseAnalysisFailedPayload",
        "SseAnalysisPausedChangedPayload",
        "SseResourceModifiedPayload",
        "SseOverlapStatistics",
        "TelegramBotConfig",
        "DiscordWebhookConfig",
        "HttpWebhookConfig",
        "MqttConfig",
        "ActionTriggerConditions",
    }
    missing = expected - set(components)
    assert not missing, f"OpenAPI components missing: {sorted(missing)}"

    stream_response = schema["paths"]["/api/v1/events"]["get"]["responses"]["200"]
    stream_schema = stream_response["content"]["text/event-stream"]["schema"]
    assert stream_schema == {"$ref": "#/components/schemas/SseEventEnvelope"}

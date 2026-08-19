"""Collector SSE: aggregate status events and subscriber limits."""

from __future__ import annotations

import json

from fastapi import FastAPI

from server.collector.manager import CollectorManager
from server.sse import SseBroadcaster


async def test_sse_subscriber_limit():
    broadcaster = SseBroadcaster()
    queues = [broadcaster.subscribe() for _ in range(12)]
    assert broadcaster.subscriber_count() == 12
    assert not broadcaster.accepts_subscriber()
    for queue in queues:
        broadcaster.unsubscribe(queue)
    assert broadcaster.accepts_subscriber()


async def test_publish_aggregate_collector_status_without_adapters(app: FastAPI):
    broadcaster = app.state.broadcaster
    queue = broadcaster.subscribe()
    manager = CollectorManager(app.state.db, broadcaster)
    try:
        await manager._publish_aggregate_collector_status()
        event = queue.get_nowait()
    finally:
        broadcaster.unsubscribe(queue)

    assert event["event"] == "collector_status_changed"
    payload = json.loads(event["data"])["payload"]
    assert payload["status"] == "stopped"
    assert "adapterName" not in payload


async def test_publish_aggregate_collector_status_includes_adapter_error_fields(app: FastAPI):
    broadcaster = app.state.broadcaster
    queue = broadcaster.subscribe()
    manager = CollectorManager(app.state.db, broadcaster)
    try:
        await manager._publish_aggregate_collector_status(
            adapter_name="telegram",
            error_summary="connection refused",
        )
        event = queue.get_nowait()
    finally:
        broadcaster.unsubscribe(queue)

    payload = json.loads(event["data"])["payload"]
    assert payload["status"] == "stopped"
    assert payload["adapterName"] == "telegram"
    assert payload["errorSummary"] == "connection refused"
    assert "correlation_id" in payload

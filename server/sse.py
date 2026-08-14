"""SSE broadcaster and the authoritative event payload builders.

Wire format: each SSE frame is a named event whose
``data`` is ``{"type": <event>, "payload": {...camelCase...}}``. The frontend
``sseClient.ts`` listens for the named events and unwraps ``payload``.

Payload shapes are documented as OpenAPI components
(``server/api/schemas/responses/sse.py`` — ``SseEventEnvelope`` +
``Sse*Payload``); ``test_contract_sse.py`` guards publish sites against them.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Protocol

from fastapi import Request
from sse_starlette.sse import EventSourceResponse

logger = logging.getLogger(__name__)


class Broadcaster(Protocol):
    """Structural publish() interface so tests can pass lightweight recorders."""

    def publish(self, event_type: str, payload: dict) -> None: ...


#: Event names the frontend subscribes to (web/src/api/sseClient.ts).
EVENT_TYPES = (
    "messages_updated",
    "collector_status_changed",
    "source_status_changed",
    "analysis_started",
    "analysis_completed",
    "analysis_failed",
    "analysis_paused_changed",
    "resource_modified",
)


def publish_resource_modified(
    broadcaster: Broadcaster | None,
    *,
    resource_type: str,
    resource_id: str,
    action: str,
) -> None:
    """Emit the ``resource_modified`` SSE event — the only place it is built.

    Best-effort by design: a missing broadcaster (agent tests) or a fan-out
    failure must never turn a committed write into an error response.
    """
    if broadcaster is None or not resource_id:
        return
    try:
        broadcaster.publish(
            "resource_modified",
            {"resourceType": resource_type, "resourceId": str(resource_id), "action": action},
        )
    except Exception:  # noqa: BLE001 — notification failures never fail the write
        logger.warning("Failed to publish resource_modified for %s %s", resource_type, resource_id)


_QUEUE_MAX = 256
_KEEPALIVE_SECONDS = 30
# Dev + multi-tab/Electron can open several streams; cap avoids Windows socket exhaustion.
_MAX_SUBSCRIBERS = 12


class SseCapacityError(Exception):
    """Raised when the SSE subscriber limit is reached."""


@dataclass
class SseBroadcaster:
    """Fan-out broadcaster: one bounded queue per subscriber.

    Slow clients drop events instead of blocking the producers.
    """

    _subscribers: set[asyncio.Queue] = field(default_factory=set)

    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def accepts_subscriber(self) -> bool:
        return len(self._subscribers) < _MAX_SUBSCRIBERS

    def subscribe(self) -> asyncio.Queue:
        if not self.accepts_subscriber():
            raise SseCapacityError(f"SSE subscriber limit ({_MAX_SUBSCRIBERS}) reached")
        queue: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._subscribers.add(queue)
        logger.debug("SSE subscriber connected (%d active)", len(self._subscribers))
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)
        logger.debug("SSE subscriber disconnected (%d active)", len(self._subscribers))

    def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        """Queue an event for every subscriber (non-blocking)."""
        frame = {
            "event": event_type,
            "data": json.dumps({"type": event_type, "payload": payload}, ensure_ascii=False),
        }
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(frame)
            except asyncio.QueueFull:
                logger.warning(
                    "Dropping SSE event %r for slow subscriber (queue full, %d subscribers)",
                    event_type,
                    len(self._subscribers),
                )


def event_stream(
    broadcaster: SseBroadcaster,
    request: Request,
    queue: asyncio.Queue,
) -> EventSourceResponse:
    """Build the ``GET /api/v1/events`` streaming response.

    The caller must already hold a queue from ``subscribe()``: admitting the
    subscriber in the route and streaming it here keeps the capacity check and
    the registration in one synchronous step. Subscribing lazily inside the
    generator let concurrent requests all pass the limit check before any of
    them registered.
    """

    async def generator() -> AsyncIterator[dict[str, Any]]:
        try:
            while True:
                if await request.is_disconnected():
                    return
                try:
                    frame = await asyncio.wait_for(queue.get(), timeout=_KEEPALIVE_SECONDS)
                    yield frame
                except TimeoutError:
                    yield {"comment": "keep-alive"}
        finally:
            broadcaster.unsubscribe(queue)

    return EventSourceResponse(generator())

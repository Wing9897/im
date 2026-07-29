"""SSE event stream route."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.deps import API_DEPS
from server.errors import SSE_CAPACITY, http_error
from server.sse import _MAX_SUBSCRIBERS, SseBroadcaster, SseCapacityError, event_stream

router = APIRouter(tags=["events"], dependencies=API_DEPS)


@router.get("/api/v1/events")
async def events(request: Request) -> Any:  # noqa: ANN401
    """SSE stream. EventSource cannot send headers; verify_auth (via API_DEPS)
    accepts ?token= and the loopback bypass."""
    broadcaster: SseBroadcaster = request.app.state.broadcaster
    # Admit here rather than in the stream generator: subscribe() checks the cap
    # and registers in one synchronous step, so concurrent requests cannot all
    # pass the check before any of them takes a slot.
    try:
        queue = broadcaster.subscribe()
    except SseCapacityError as exc:
        raise http_error(
            503,
            f"Too many SSE connections (max {_MAX_SUBSCRIBERS})",
            error_code=SSE_CAPACITY,
        ) from exc
    return event_stream(broadcaster, request, queue)

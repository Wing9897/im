"""Unit tests for server/http_limits.py middleware."""

from __future__ import annotations

import pytest

from server.http_limits import (
    MAX_REQUEST_BODY_BYTES,
    RateLimitMiddleware,
    RequestBodyLimitMiddleware,
)


async def _noop_app(_scope, _receive, send):
    await send({"type": "http.response.start", "status": 204, "headers": []})
    await send({"type": "http.response.body", "body": b""})


async def test_request_body_limit_rejects_oversized_content_length() -> None:
    middleware = RequestBodyLimitMiddleware(_noop_app, max_body_size=16)
    scope = {
        "type": "http",
        "headers": [(b"content-length", b"32")],
    }
    statuses: list[int] = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            statuses.append(int(message["status"]))

    await middleware(scope, receive, send)

    assert statuses == [413]


async def test_request_body_limit_rejects_chunked_overflow() -> None:
    async def app(_scope, receive, send):
        while True:
            message = await receive()
            if message["type"] != "http.request" or not message.get("more_body"):
                break
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    middleware = RequestBodyLimitMiddleware(app, max_body_size=8)
    scope = {"type": "http", "headers": []}
    statuses: list[int] = []
    chunks = [b"12345", b"67890"]

    async def receive():
        if chunks:
            return {"type": "http.request", "body": chunks.pop(0), "more_body": bool(chunks)}
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            statuses.append(int(message["status"]))

    await middleware(scope, receive, send)

    assert statuses == [413]


async def test_request_body_limit_allows_small_body() -> None:
    app_calls = 0

    async def app(_scope, _receive, send):
        nonlocal app_calls
        app_calls += 1
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    middleware = RequestBodyLimitMiddleware(app, max_body_size=32)
    scope = {"type": "http", "headers": [(b"content-length", b"4")]}

    async def receive():
        return {"type": "http.request", "body": b"data", "more_body": False}

    async def send(_message):
        return None

    await middleware(scope, receive, send)

    assert app_calls == 1


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/api/v1/messages/batch", 120),
        ("/api/v1/tasks/chat-assistant", 120),
        ("/api/v1/system/llm/test", 120),
        ("/api/v1/accounts/acc-1/media", 120),
        ("/api/v1/tasks", 600),
    ],
)
def test_rate_limit_for_path(path: str, expected: int) -> None:
    assert RateLimitMiddleware._limit_for(path) == expected


async def test_rate_limit_middleware_skips_non_api_paths() -> None:
    app_calls = 0

    async def app(_scope, _receive, send):
        nonlocal app_calls
        app_calls += 1
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    middleware = RateLimitMiddleware(app)
    scope = {"type": "http", "path": "/health", "client": ("127.0.0.1", 1), "headers": []}

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(_message):
        return None

    await middleware(scope, receive, send)

    assert app_calls == 1


async def test_max_request_body_bytes_constant() -> None:
    assert MAX_REQUEST_BODY_BYTES == 10 * 1024 * 1024

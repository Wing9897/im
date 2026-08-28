"""Small HTTP safety limits shared by every deployment mode."""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024
_RATE_WINDOW_SECONDS = 60.0


class RequestBodyTooLarge(Exception):
    pass


class RequestBodyLimitMiddleware:
    """Reject oversized request bodies, including chunked uploads."""

    def __init__(self, app: ASGIApp, max_body_size: int = MAX_REQUEST_BODY_BYTES) -> None:
        self._app = app
        self._max_body_size = max_body_size

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > self._max_body_size:
                    await self._reject(scope, receive, send)
                    return
            except ValueError:
                pass

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self._max_body_size:
                    raise RequestBodyTooLarge
            return message

        try:
            await self._app(scope, limited_receive, send)
        except RequestBodyTooLarge:
            await self._reject(scope, receive, send)

    @staticmethod
    async def _reject(scope: Scope, receive: Receive, send: Send) -> None:
        response = JSONResponse({"detail": "Request body too large"}, status_code=413)
        await response(scope, receive, send)


class RateLimitMiddleware:
    """In-memory per-IP and per-token quotas for the single-process service."""

    def __init__(self, app: ASGIApp) -> None:
        self._app = app
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._last_cleanup = time.monotonic()

    @staticmethod
    def _limit_for(path: str) -> int:
        if path.endswith("/media") or path in {
            "/api/v1/messages/batch",
            "/api/v1/system/llm/test",
        }:
            return 120
        return 600

    @staticmethod
    def _client_keys(scope: Scope) -> tuple[str, ...]:
        client = scope.get("client")
        host = str(client[0]) if client else "unknown"
        keys = [f"ip:{host}"]
        headers = dict(scope.get("headers") or [])
        authorization = headers.get(b"authorization", b"")
        if authorization:
            digest = hashlib.sha256(authorization).hexdigest()
            keys.append(f"token:{digest}")
        return tuple(keys)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = str(scope.get("path") or "")
        # Calendar-share skips this limiter; IC numbers: test_contract_calendar_share_ic.
        if scope["type"] != "http" or not path.startswith("/api/v1/") or path.startswith("/api/v1/calendar-share"):
            await self._app(scope, receive, send)
            return

        now = time.monotonic()
        limit = self._limit_for(path)
        cutoff = now - _RATE_WINDOW_SECONDS
        if now - self._last_cleanup >= _RATE_WINDOW_SECONDS:
            stale = [key for key, bucket in self._requests.items() if not bucket or bucket[-1] <= cutoff]
            for key in stale:
                self._requests.pop(key, None)
            self._last_cleanup = now
        buckets = [self._requests[key] for key in self._client_keys(scope)]
        for bucket in buckets:
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                response = JSONResponse(
                    {"detail": "Too many requests"},
                    status_code=429,
                    headers={"Retry-After": str(int(_RATE_WINDOW_SECONDS))},
                )
                await response(scope, receive, send)
                return
        for bucket in buckets:
            bucket.append(now)
        await self._app(scope, receive, send)

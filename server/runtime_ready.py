"""Block business APIs until schema upgrade completes."""

from __future__ import annotations

from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from server.errors import SCHEMA_UPGRADE_REQUIRED, error_body

_ALLOWED_PREFIXES = (
    "/api/v1/health",
    "/api/v1/system/schema",
)


def _is_allowed(path: str) -> bool:
    if path == "/" or not path.startswith("/api/"):
        # SPA assets and index HTML must load so the upgrade gate UI can render.
        return True
    return any(path == prefix or path.startswith(prefix + "/") for prefix in _ALLOWED_PREFIXES)


class RuntimeReadyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        lifecycle = getattr(request.app.state, "schema_lifecycle", None)
        if lifecycle is None or lifecycle.runtime_ready:
            return await call_next(request)
        if _is_allowed(request.url.path):
            return await call_next(request)
        return JSONResponse(
            status_code=503,
            content=error_body(
                503,
                "Database schema upgrade required before the application can continue",
                error_code=SCHEMA_UPGRADE_REQUIRED,
                details=lifecycle.snapshot(),
            ),
        )

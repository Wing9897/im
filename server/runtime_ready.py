"""Block business APIs while stored secrets cannot be decrypted."""

from __future__ import annotations

from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from server.errors import SECRETS_UNAVAILABLE, error_body

_ALLOWED_PREFIXES = (
    "/api/v1/health",
    "/api/v1/setup/status",
)

# Recovery POSTs while schema/secrets gates are closed (rotate preferred; reset for wipe).
_RECOVERY_POST_PATHS = frozenset(
    {
        "/api/v1/system/rotate-secrets",
        "/api/v1/system/reset/database",
    }
)


def _is_allowed(path: str, method: str) -> bool:
    if path == "/" or not path.startswith("/api/"):
        # SPA assets and index HTML must load so the secrets recovery UI can render.
        return True
    if method.upper() == "POST" and path in _RECOVERY_POST_PATHS:
        return True
    return any(path == prefix or path.startswith(prefix + "/") for prefix in _ALLOWED_PREFIXES)


class RuntimeReadyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        method = request.method
        allowed = _is_allowed(path, method)

        secrets_ready = getattr(request.app.state, "secrets_ready", True)
        if not secrets_ready:
            if allowed:
                return await call_next(request)
            secrets_error = getattr(request.app.state, "secrets_error", None)
            details: dict[str, object] = {"secretsReady": False}
            if secrets_error:
                details["secretsError"] = str(secrets_error)
            return JSONResponse(
                status_code=503,
                content=error_body(
                    503,
                    "Local encryption key cannot decrypt stored secrets",
                    error_code=SECRETS_UNAVAILABLE,
                    details=details,
                ),
            )

        return await call_next(request)

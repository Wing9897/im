"""Lightweight household auth: admin password → device session; revocable API keys.

Scopes are intentionally small:
- ``*`` — full read/write (automation, A2A, webhooks)
- ``read`` — GET/HEAD/OPTIONS only (port-forward safe viewers)

Device sessions always have full access after admin login. Loopback may be
temporarily exempt until the household is secured (see ``localhost_auth_exempt``).
"""

from __future__ import annotations

from fastapi import Request

from server.access_keys import (
    READ_SCOPE,
    access_key_allows_method,
    resolve_access_token,
    touch_access_key_last_used,
)
from server.config import get_config_bool
from server.db.database import Database
from server.device_auth import (
    credentials_configured,
    maybe_touch_session,
    resolve_session_id_for_access_token,
)
from server.errors import AUTH_SETUP_REQUIRED, FORBIDDEN, http_error

_LOOPBACK_HOSTS = ("127.0.0.1", "::1", "localhost", "testclient")
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def is_loopback(request: Request) -> bool:
    client = request.client
    return client is not None and client.host in _LOOPBACK_HOSTS


def presented_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    # EventSource cannot set headers; the SSE endpoint passes ?token=.
    return request.query_params.get("token", "")


def _clear_access_key_state(request: Request) -> None:
    request.state.access_key_id = None
    request.state.access_key_scopes = None


async def _attach_access_key_state(request: Request, db: Database, token: str) -> bool:
    resolved = await resolve_access_token(db, token)
    if resolved is None:
        _clear_access_key_state(request)
        return False
    request.state.access_key_id = resolved["id"]
    request.state.access_key_scopes = list(resolved["scopes"])
    return True


def _enforce_access_key_method(request: Request) -> None:
    scopes = getattr(request.state, "access_key_scopes", None)
    if scopes is None:
        return
    if access_key_allows_method(request.method, list(scopes)):
        return
    raise http_error(
        403,
        f"Access key is read-only; {request.method} requires full scope (*)",
        error_code=FORBIDDEN,
    )


async def _accept_access_key(request: Request, db: Database) -> None:
    _enforce_access_key_method(request)
    key_id = getattr(request.state, "access_key_id", None)
    if key_id:
        await touch_access_key_last_used(db, str(key_id))


async def verify_auth(request: Request) -> None:
    db: Database = request.app.state.db
    _clear_access_key_state(request)
    if is_loopback(request) and await get_config_bool(db, "localhost_auth_exempt"):
        token = presented_token(request)
        if token and await _attach_access_key_state(request, db, token):
            await _accept_access_key(request, db)
        return
    token = presented_token(request)
    if await _attach_access_key_state(request, db, token):
        await _accept_access_key(request, db)
        return
    session_id = await resolve_session_id_for_access_token(db, token)
    if session_id is not None:
        await maybe_touch_session(db, session_id)
        return
    if not await credentials_configured(db):
        raise http_error(
            503,
            "Remote access requires an API key or device session; none is configured",
            error_code=AUTH_SETUP_REQUIRED,
        )
    raise http_error(401, "Invalid or missing Bearer token")


async def verify_write_access(request: Request) -> None:
    db: Database = request.app.state.db
    token = presented_token(request)

    if is_loopback(request):
        if token and await _attach_access_key_state(request, db, token):
            _enforce_access_key_method(request)
        return
    if request.method in _SAFE_METHODS:
        return

    if await _attach_access_key_state(request, db, token):
        _enforce_access_key_method(request)
        return

    if await resolve_session_id_for_access_token(db, token) is not None:
        return

    if not request.url.path.startswith("/api/v1/viewer/"):
        raise http_error(
            403,
            "Remote clients have read-only access",
            error_code=FORBIDDEN,
        )


__all__ = [
    "READ_SCOPE",
    "is_loopback",
    "presented_token",
    "verify_auth",
    "verify_write_access",
]

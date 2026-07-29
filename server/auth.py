"""Auth: Bearer token + localhost bypass + remote write protection.

Semantics:
- verify_auth: loopback clients pass when ``localhost_auth_exempt`` (default
  true). Otherwise clients need a valid household API key **or** a valid
  device access token (``Authorization: Bearer …`` or SSE ``?token=``).
  When neither API keys nor device sessions exist → 503 AUTH_SETUP_REQUIRED.
  Access keys without ``*`` are limited to ``/api/v1/a2a/`` (403 elsewhere),
  including when presented on loopback under the exempt path.
- verify_write_access: loopback unrestricted unless a scoped (non-``*``)
  access key is presented. Remote POST/PUT/PATCH/DELETE is allowed when the
  presented Bearer matches any active access key or device access token
  (same check as ``verify_auth``, including scope path limits). Otherwise
  403 FORBIDDEN except paths under ``/api/v1/viewer/``.
- ``/api/v1/health``, schema gate, and public setup endpoints are mounted
  without auth dependencies.
"""

from __future__ import annotations

from fastapi import Request

from server.access_keys import (
    access_key_path_allowed,
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
    """If ``token`` is a household access key, attach id/scopes to request.state."""
    resolved = await resolve_access_token(db, token)
    if resolved is None:
        _clear_access_key_state(request)
        return False
    request.state.access_key_id = resolved["id"]
    request.state.access_key_scopes = list(resolved["scopes"])
    return True


def _enforce_access_key_path(request: Request) -> None:
    """Reject non-``*`` access keys outside ``/api/v1/a2a/``."""
    scopes = getattr(request.state, "access_key_scopes", None)
    if scopes is None:
        return
    path = request.url.path
    if access_key_path_allowed(path, list(scopes)):
        return
    raise http_error(
        403,
        f"Access key missing required scope: * for path {path}",
        error_code=FORBIDDEN,
    )


async def _accept_access_key(request: Request, db: Database) -> None:
    """Enforce path scopes and touch last_used for an attached access key."""
    _enforce_access_key_path(request)
    key_id = getattr(request.state, "access_key_id", None)
    if key_id:
        await touch_access_key_last_used(db, str(key_id))


async def verify_auth(request: Request) -> None:
    db: Database = request.app.state.db
    _clear_access_key_state(request)
    if is_loopback(request) and await get_config_bool(db, "localhost_auth_exempt"):
        # Still attach key state when a Bearer access key is presented (A2A / audits).
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
        # Scoped keys presented on loopback are still path-limited.
        if token and await _attach_access_key_state(request, db, token):
            _enforce_access_key_path(request)
        return
    if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
        return

    if await _attach_access_key_state(request, db, token):
        _enforce_access_key_path(request)
        return

    if await resolve_session_id_for_access_token(db, token) is not None:
        return

    if not request.url.path.startswith("/api/v1/viewer/"):
        raise http_error(
            403,
            "Remote clients have read-only access",
            error_code=FORBIDDEN,
        )

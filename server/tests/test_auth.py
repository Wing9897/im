"""Unit tests for server/auth.py localhost bypass and remote write boundaries."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import FastAPI, HTTPException
from starlette.requests import Request

from server.access_keys import READ_SCOPE, seed_access_key
from server.auth import is_loopback, presented_token, verify_auth, verify_write_access
from server.config import set_configs
from server.device_auth import create_device_session

API_KEY = "unit-test-api-key"
A2A_ONLY_KEY = "unit-test-a2a-only-key"


def _make_request(
    *,
    host: str = "127.0.0.1",
    method: str = "GET",
    path: str = "/api/v1/tasks",
    headers: dict[str, str] | None = None,
    query: str = "",
    app: FastAPI | None = None,
) -> Request:
    query_string = query.lstrip("?").encode() if query else b""
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
        "query_string": query_string,
        "client": (host, 12345),
        "server": ("testserver", 80),
    }
    if app is not None:
        scope["app"] = app

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


@pytest.mark.parametrize(
    "host",
    ["127.0.0.1", "::1", "localhost", "testclient"],
)
def test_is_loopback_recognizes_local_hosts(host: str) -> None:
    assert is_loopback(_make_request(host=host)) is True


def test_is_loopback_rejects_remote_host() -> None:
    assert is_loopback(_make_request(host="203.0.113.9")) is False


def test_presented_token_prefers_bearer_header() -> None:
    request = _make_request(headers={"Authorization": "Bearer secret-token"})
    assert presented_token(request) == "secret-token"


def test_presented_token_falls_back_to_query_param() -> None:
    request = _make_request(query="?token=sse-token")
    assert presented_token(request) == "sse-token"


async def test_verify_auth_loopback_bypass_when_exempt(app) -> None:
    await set_configs(app.state.db, {"localhost_auth_exempt": "true"})
    request = _make_request(host="127.0.0.1", app=app)

    await verify_auth(request)


async def test_verify_auth_loopback_requires_key_when_exempt_disabled(app) -> None:
    await set_configs(app.state.db, {"localhost_auth_exempt": "false"})
    await seed_access_key(app.state.db, API_KEY, label="Unit")
    request = _make_request(host="127.0.0.1", app=app)

    with pytest.raises(HTTPException) as exc:
        await verify_auth(request)
    assert exc.value.status_code == 401

    request_ok = _make_request(
        host="127.0.0.1",
        headers={"Authorization": f"Bearer {API_KEY}"},
        app=app,
    )
    await verify_auth(request_ok)


async def test_verify_auth_remote_without_key_is_503(app) -> None:
    request = _make_request(host="203.0.113.9", app=app)

    with pytest.raises(HTTPException) as exc:
        await verify_auth(request)
    assert exc.value.status_code == 503
    detail = cast(dict[str, Any], exc.value.detail)
    assert isinstance(detail, dict)
    assert detail["error_code"] == "AUTH_SETUP_REQUIRED"


async def test_verify_auth_accepts_device_access_token(app) -> None:
    await set_configs(app.state.db, {"localhost_auth_exempt": "false"})
    tokens = await create_device_session(app.state.db, label="Unit")
    request = _make_request(
        host="203.0.113.9",
        headers={"Authorization": f"Bearer {tokens['accessToken']}"},
        app=app,
    )
    await verify_auth(request)

    bad = _make_request(
        host="203.0.113.9",
        headers={"Authorization": "Bearer not-a-real-token"},
        app=app,
    )
    with pytest.raises(HTTPException) as exc:
        await verify_auth(bad)
    assert exc.value.status_code == 401


async def test_verify_write_access_loopback_allows_writes(app) -> None:
    request = _make_request(host="127.0.0.1", method="POST", path="/api/v1/tasks", app=app)

    await verify_write_access(request)


async def test_verify_write_access_remote_blocks_non_viewer_writes_without_token(
    app,
) -> None:
    request = _make_request(host="203.0.113.9", method="POST", path="/api/v1/tasks", app=app)

    with pytest.raises(HTTPException) as exc:
        await verify_write_access(request)
    assert exc.value.status_code == 403
    detail = cast(dict[str, Any], exc.value.detail)
    assert isinstance(detail, dict)
    assert detail["error_code"] == "FORBIDDEN"


async def test_verify_write_access_remote_allows_writes_with_valid_bearer(app) -> None:
    await seed_access_key(app.state.db, API_KEY, label="Unit")
    request = _make_request(
        host="203.0.113.9",
        method="PUT",
        path="/api/v1/ui-prefs/board",
        headers={"Authorization": f"Bearer {API_KEY}"},
        app=app,
    )

    await verify_write_access(request)


async def test_verify_write_access_remote_allows_viewer_writes(app) -> None:
    request = _make_request(host="203.0.113.9", method="POST", path="/api/v1/viewer/foo", app=app)

    await verify_write_access(request)


async def test_verify_write_access_remote_allows_get(app) -> None:
    request = _make_request(host="203.0.113.9", method="GET", path="/api/v1/tasks", app=app)

    await verify_write_access(request)


async def test_verify_auth_read_only_key_allows_get(app) -> None:
    await seed_access_key(app.state.db, A2A_ONLY_KEY, label="Read", scopes=[READ_SCOPE])
    request = _make_request(
        host="203.0.113.9",
        method="GET",
        path="/api/v1/tasks",
        headers={"Authorization": f"Bearer {A2A_ONLY_KEY}"},
        app=app,
    )

    await verify_auth(request)
    assert request.state.access_key_scopes == [READ_SCOPE]


async def test_verify_auth_read_only_key_forbidden_on_post(app) -> None:
    await seed_access_key(app.state.db, A2A_ONLY_KEY, label="Read", scopes=[READ_SCOPE])
    request = _make_request(
        host="203.0.113.9",
        method="POST",
        path="/api/v1/tasks",
        headers={"Authorization": f"Bearer {A2A_ONLY_KEY}"},
        app=app,
    )

    with pytest.raises(HTTPException) as exc:
        await verify_auth(request)
    assert exc.value.status_code == 403
    detail = cast(dict[str, Any], exc.value.detail)
    assert detail["error_code"] == "FORBIDDEN"
    assert "read-only" in detail["message"]


async def test_verify_auth_star_key_allows_tasks(app) -> None:
    await seed_access_key(app.state.db, API_KEY, label="Full", scopes=["*"])
    request = _make_request(
        host="203.0.113.9",
        path="/api/v1/tasks",
        headers={"Authorization": f"Bearer {API_KEY}"},
        app=app,
    )

    await verify_auth(request)


async def test_verify_auth_loopback_exempt_still_scopes_presented_key(app) -> None:
    await set_configs(app.state.db, {"localhost_auth_exempt": "true"})
    await seed_access_key(app.state.db, A2A_ONLY_KEY, label="Read", scopes=[READ_SCOPE])
    request = _make_request(
        host="127.0.0.1",
        method="POST",
        path="/api/v1/access-keys",
        headers={"Authorization": f"Bearer {A2A_ONLY_KEY}"},
        app=app,
    )

    with pytest.raises(HTTPException) as exc:
        await verify_auth(request)
    assert exc.value.status_code == 403


async def test_verify_write_access_remote_read_only_key_forbidden(app) -> None:
    await seed_access_key(app.state.db, A2A_ONLY_KEY, label="Read", scopes=[READ_SCOPE])
    request = _make_request(
        host="203.0.113.9",
        method="POST",
        path="/api/v1/tasks",
        headers={"Authorization": f"Bearer {A2A_ONLY_KEY}"},
        app=app,
    )

    with pytest.raises(HTTPException) as exc:
        await verify_write_access(request)
    assert exc.value.status_code == 403

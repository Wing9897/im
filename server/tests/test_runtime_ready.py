"""Focused readiness-gate coverage for secrets recovery startup."""

from __future__ import annotations

import pytest

from server.runtime_ready import _is_allowed


@pytest.mark.parametrize(
    ("path", "method"),
    [
        ("/", "GET"),
        ("/assets/app.js", "GET"),
        ("/api/v1/health", "GET"),
        ("/api/v1/health/details", "GET"),
        ("/api/v1/setup/status", "GET"),
        ("/api/v1/system/rotate-secrets", "POST"),
        ("/api/v1/system/reset/database", "POST"),
    ],
)
def test_readiness_gate_allows_status_ui_and_recovery_paths(path: str, method: str) -> None:
    assert _is_allowed(path, method)


@pytest.mark.parametrize(
    ("path", "method"),
    [
        ("/api/v1/tasks", "GET"),
        ("/api/v1/viewer/stats", "GET"),
        ("/api/v1/system/rotate-secrets", "GET"),
        ("/api/v1/system/reset/database", "DELETE"),
    ],
)
def test_readiness_gate_blocks_business_and_wrong_method_paths(path: str, method: str) -> None:
    assert not _is_allowed(path, method)


async def test_readiness_middleware_returns_structured_503_and_keeps_health_available(client, app) -> None:
    app.state.secrets_ready = False
    app.state.secrets_error = "test decrypt failure"
    try:
        blocked = await client.get("/api/v1/tasks")
        health = await client.get("/api/v1/health")
    finally:
        app.state.secrets_ready = True
        app.state.secrets_error = None

    assert blocked.status_code == 503
    assert blocked.json()["error_code"] == "SECRETS_UNAVAILABLE"
    assert blocked.json()["details"] == {
        "secretsReady": False,
        "secretsError": "test decrypt failure",
    }
    assert health.status_code == 200
    assert health.json()["secretsReady"] is False

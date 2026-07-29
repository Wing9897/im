"""Removed API endpoints must stay gone (404/405)."""

from __future__ import annotations

from typing import Any

import pytest

from server.tests import seed


def removed_endpoints(*, task_id: str, action_id: str) -> list[tuple[str, str, dict[str, Any] | None]]:
    return [
        ("GET", "/health", None),
        ("GET", "/api/v1/messages", None),
        ("POST", "/api/v1/channels", {}),
        # Plain channel list: every caller needs /channels/with-accounts instead.
        ("GET", "/api/v1/channels", None),
        ("POST", "/api/v1/tasks/suggest", {}),
        ("POST", f"/api/v1/tasks/{task_id}/preview-invalidation", {}),
        ("DELETE", "/api/v1/results/batches/stats", None),
        ("DELETE", "/api/v1/results/batches/failed", None),
        ("GET", "/api/v1/actions/history", None),
        ("GET", f"/api/v1/actions/{action_id}/history", None),
        ("GET", "/api/v1/actions/stats", None),
        ("POST", "/api/v1/system/analysis/resume", {}),
        ("POST", f"/api/v1/tasks/{task_id}/reset-failed", {}),
        ("POST", f"/api/v1/tasks/{task_id}/acknowledge-failed", {}),
        ("GET", "/api/v1/config/values", None),
        ("PUT", "/api/v1/config/values", {"updates": []}),
        ("GET", "/api/v1/results/benefits", None),
        ("GET", "/api/v1/results/schedule", None),
        ("POST", "/api/v1/results/batches/dead-endpoint-probe/retry", {}),
        ("GET", "/api/v1/config/retention", None),
        ("PUT", "/api/v1/config/retention", {}),
        ("GET", "/api/v1/viewer/results/leaderboard", None),
        ("GET", "/api/v1/viewer/results/benefits", None),
        ("GET", "/api/v1/viewer/results/timeline", None),
        ("POST", "/api/v1/config/api-key/generate", {}),
        ("GET", "/api/v1/config/api-key/status", None),
        # Retired setup pairing / bootstrap (admin password auth, schema v13).
        ("POST", "/api/v1/setup/bootstrap", {"label": "Host"}),
        ("POST", "/api/v1/setup/pairing-code", {}),
        ("POST", "/api/v1/setup/pair", {"code": "DEADCODE", "label": "x"}),
        # Retired API-key → device-session bridge (automation keys stay Bearer-only).
        ("POST", "/api/v1/setup/login-with-api-key", {"apiKey": "dead", "label": "x"}),
        # Merged into POST /api/v1/system/reset/database (single full-reset path).
        ("POST", "/api/v1/system/reset/runtime", {}),
    ]


_DEAD_ENDPOINTS = removed_endpoints(task_id=seed.TASK_LEADERBOARD, action_id=seed.ACTION_1)


@pytest.mark.parametrize("method,path,body", _DEAD_ENDPOINTS)
async def test_dead_endpoint_returns_not_found(client, method: str, path: str, body: dict | None):
    if method == "GET":
        resp = await client.get(path)
    elif method == "DELETE":
        resp = await client.delete(path)
    elif method == "PUT":
        resp = await client.put(path, json=body)
    else:
        resp = await client.post(path, json=body)
    assert resp.status_code in (404, 405), f"{method} {path} expected 404/405, got {resp.status_code}"

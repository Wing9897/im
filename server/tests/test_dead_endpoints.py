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
        # Plain channel list: every caller needs /channels/with-sources instead.
        ("GET", "/api/v1/channels", None),
        ("POST", "/api/v1/tasks/suggest", {}),
        # FE uses agent ``tasks.consult_advisor``; REST chat-assistant retired.
        ("POST", "/api/v1/tasks/chat-assistant", {"messages": []}),
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
        # Calendar surface unified under /api/v1/calendar/*.
        ("GET", "/api/v1/results/calendar", None),
        ("POST", "/api/v1/calendar-imports/preview", {}),
        ("POST", "/api/v1/calendar-imports/commit", {}),
        ("GET", "/api/v1/timeline/dismissals", None),
        ("POST", "/api/v1/timeline/dismissals", {}),
        ("PATCH", "/api/v1/timeline/dismissals", {}),
        ("PUT", "/api/v1/timeline/dismissals", {}),
        ("DELETE", "/api/v1/timeline/dismissals", None),
        ("GET", "/api/v1/user-events", None),
        ("POST", "/api/v1/user-events", {}),
        ("PATCH", "/api/v1/user-events", {}),
        ("PUT", "/api/v1/user-events", {}),
        ("DELETE", "/api/v1/user-events", None),
        # Schema upgrade gate retired (wipe-only stamp 26).
        ("GET", "/api/v1/system/schema/status", None),
        ("POST", "/api/v1/system/schema/upgrade", {}),
        # Retired collector accounts surface (sources hard-cut; stay 404).
        ("GET", "/api/v1/accounts", None),
        ("GET", "/api/v1/accounts/telegram", None),
        ("GET", "/api/v1/accounts/discord", None),
        ("GET", "/api/v1/accounts/rss", None),
        ("GET", "/api/v1/accounts/http", None),
        ("GET", "/api/v1/accounts/mqtt", None),
        ("GET", "/api/v1/accounts/email", None),
        ("POST", "/api/v1/accounts/refresh-all", {}),
        ("POST", "/api/v1/accounts/telegram", {}),
        ("POST", "/api/v1/accounts/discord", {}),
        ("POST", "/api/v1/accounts/rss", {}),
        ("POST", "/api/v1/accounts/http", {}),
        ("POST", "/api/v1/accounts/mqtt", {}),
        ("POST", "/api/v1/accounts/email", {}),
        ("GET", "/api/v1/accounts/dead-endpoint-probe", None),
        ("DELETE", "/api/v1/accounts/dead-endpoint-probe", None),
        ("POST", "/api/v1/accounts/dead-endpoint-probe/reconnect", {}),
        # Retired alias of GET /api/v1/tasks/{id}/agent-ticks (project→agent rename).
        ("GET", f"/api/v1/tasks/{task_id}/project-ticks", None),
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
    elif method == "PATCH":
        resp = await client.patch(path, json=body)
    else:
        resp = await client.post(path, json=body)
    assert resp.status_code in (404, 405), f"{method} {path} expected 404/405, got {resp.status_code}"

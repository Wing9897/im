"""Auth semantics + structured error body contract.

- Loopback bypass; remote requires Bearer access key **or** device session
  (503 AUTH_SETUP_REQUIRED if neither is available / household unset).
- Remote writes without a Bearer hit `verify_auth` first → 401 AUTH_REQUIRED
  (not 403). With a valid household (`*`) key, remote clients may write like
  loopback. Non-`*` keys (``read``) may GET but not write — writes get 403.
- Non-2xx bodies carry {error_code, message, details, correlation_id}
  (snake_case) — parseApiError.ts prefers this structured shape, and 401 must
  map to AUTH_REQUIRED for the ErrorToast Sources API shortcut.
"""

from __future__ import annotations

from server.auth.access_keys import READ_SCOPE, seed_access_key

API_KEY = "contract-test-key-123"
A2A_ONLY_KEY = "contract-a2a-only-key"


def assert_structured_error(body: dict) -> None:
    for key in ("error_code", "message", "details", "correlation_id"):
        assert key in body, f"structured error body missing {key}"
    assert isinstance(body["error_code"], str)
    assert isinstance(body["message"], str) and body["message"]
    assert isinstance(body["correlation_id"], str) and body["correlation_id"]


async def test_404_error_body(client):
    resp = await client.delete("/api/v1/accounts/no-such-account")
    assert resp.status_code == 404
    body = resp.json()
    assert_structured_error(body)
    assert body["error_code"] == "NOT_FOUND"


async def test_422_error_body(client):
    resp = await client.post("/api/v1/tasks", json={"name": "", "promptTemplate": ""})
    assert resp.status_code == 422
    assert_structured_error(resp.json())
    assert resp.json()["error_code"] == "VALIDATION_ERROR"


async def test_remote_without_key_configured_is_503(remote_client):
    resp = await remote_client.get("/api/v1/tasks")
    assert resp.status_code == 503
    body = resp.json()
    assert_structured_error(body)
    assert body["error_code"] == "AUTH_SETUP_REQUIRED"


async def test_remote_auth_flow(app, remote_client):
    await seed_access_key(app.state.db, API_KEY, label="Contract")

    # Wrong/missing token → 401 AUTH_REQUIRED (drives the Sources API toast).
    unauthorized = await remote_client.get("/api/v1/tasks")
    assert unauthorized.status_code == 401
    assert unauthorized.json()["error_code"] == "AUTH_REQUIRED"

    wrong = await remote_client.get("/api/v1/tasks", headers={"Authorization": "Bearer nope"})
    assert wrong.status_code == 401

    # Correct Bearer token → reads allowed.
    ok = await remote_client.get("/api/v1/tasks", headers={"Authorization": f"Bearer {API_KEY}"})
    assert ok.status_code == 200

    # SSE-style ?token= fallback must also authenticate.
    via_query = await remote_client.get("/api/v1/tasks", params={"token": API_KEY})
    assert via_query.status_code == 200


async def test_remote_writes_without_bearer_are_forbidden(app, remote_client):
    await seed_access_key(app.state.db, API_KEY, label="Contract")

    write = await remote_client.post(
        "/api/v1/tasks",
        json={"name": "remote write", "promptTemplate": "x"},
    )
    assert write.status_code == 401

    write_no_header = await remote_client.put("/api/v1/ui-prefs/board", json={"layout": {}})
    assert write_no_header.status_code == 401


async def test_remote_writes_with_bearer_allowed(app, remote_client):
    await seed_access_key(app.state.db, API_KEY, label="Contract")
    headers = {"Authorization": f"Bearer {API_KEY}"}

    write = await remote_client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"name": "remote write", "promptTemplate": "x"},
    )
    assert write.status_code == 201

    # Viewer routes stay readable remotely (the whole point of viewer mode).
    viewer = await remote_client.get("/api/v1/viewer/stats", headers=headers)
    assert viewer.status_code == 200


async def test_viewer_401_without_token(app, remote_client):
    """useViewerResource.ts special-cases ApiRequestError.status === 401."""
    await seed_access_key(app.state.db, API_KEY, label="Contract")
    resp = await remote_client.get("/api/v1/viewer/stats")
    assert resp.status_code == 401


async def test_remote_read_only_key_allows_get_but_not_a2a_write(app, remote_client, client):
    await seed_access_key(app.state.db, A2A_ONLY_KEY, label="Read", scopes=[READ_SCOPE])
    headers = {"Authorization": f"Bearer {A2A_ONLY_KEY}"}

    allowed = await remote_client.get("/api/v1/tasks", headers=headers)
    assert allowed.status_code == 200

    denied = await client.post("/api/v1/a2a/agent", json={"input": "ping"}, headers=headers)
    assert denied.status_code == 403
    body = denied.json()
    assert_structured_error(body)
    assert body["error_code"] == "FORBIDDEN"


async def test_remote_read_only_key_forbidden_on_messages_and_agent_chat(app, remote_client):
    """Webhook ingest and human agent chat require full `*` — read-only must 403."""
    await seed_access_key(app.state.db, A2A_ONLY_KEY, label="Read", scopes=[READ_SCOPE])
    headers = {"Authorization": f"Bearer {A2A_ONLY_KEY}"}

    messages = await remote_client.post(
        "/api/v1/messages",
        headers=headers,
        json={
            "platform": "webhook",
            "channel_id": "scope-neg",
            "content": "should be forbidden",
        },
    )
    assert messages.status_code == 403
    messages_body = messages.json()
    assert_structured_error(messages_body)
    assert messages_body["error_code"] == "FORBIDDEN"

    agent = await remote_client.post(
        "/api/v1/agent/chat",
        headers=headers,
        json={"messages": [{"role": "user", "content": "hi"}], "sessionId": "scope-neg"},
    )
    assert agent.status_code == 403
    agent_body = agent.json()
    assert_structured_error(agent_body)
    assert agent_body["error_code"] == "FORBIDDEN"
    assert "read-only" in agent_body["message"]


async def test_sse_capacity_error_code(client, app):
    from server.sse import _MAX_SUBSCRIBERS

    broadcaster = app.state.broadcaster
    queues = [broadcaster.subscribe() for _ in range(_MAX_SUBSCRIBERS)]
    try:
        resp = await client.get("/api/v1/events")
        assert resp.status_code == 503
        body = resp.json()
        assert_structured_error(body)
        assert body["error_code"] == "SSE_CAPACITY"
    finally:
        for queue in queues:
            broadcaster.unsubscribe(queue)

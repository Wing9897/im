"""Contract keys: system / logs / health routes."""

from __future__ import annotations

from types import SimpleNamespace

from server.collector.base import AdapterStatus
from server.db.schema_bootstrap import CURRENT_SCHEMA_FINGERPRINT, CURRENT_SCHEMA_VERSION, inspect_schema
from server.tests import seed
from server.tests.contract_helpers import assert_keys

# ── system ────────────────────────────────────────────────────────────────


async def test_collector_status(client):
    resp = await client.get("/api/v1/system/collector/status")
    body = resp.json()
    assert_keys(body, ["status"], "collector status")
    assert body["status"] == "stopped"  # no collector in tests


async def test_collector_status_adapter_source_id(client, app):
    async def _get_status() -> str:
        return "running"

    app.state.collector = SimpleNamespace(
        get_status=_get_status,
        get_adapter_statuses=lambda: [
            AdapterStatus(
                name="discord",
                source_id=seed.DISCORD_SOURCE,
                connected=True,
                last_error=None,
                last_connected_at="2026-07-01T12:00:00Z",
            )
        ],
    )

    resp = await client.get("/api/v1/system/collector/status")
    body = resp.json()
    assert body["status"] == "running"
    assert len(body["adapters"]) == 1
    adapter = body["adapters"][0]
    assert_keys(
        adapter,
        ["name", "sourceId", "connected", "lastError", "lastConnectedAt"],
        "collector status adapter",
    )
    assert adapter["sourceId"] == seed.DISCORD_SOURCE


async def test_ai_engine_status(client):
    resp = await client.get("/api/v1/system/ai-engine/status")
    body = resp.json()
    assert_keys(body, ["status", "reason", "provider"], "AiEngineHealthStatus")
    assert body["status"] in ("available", "unavailable", "unknown")


async def test_ai_engine_test_contract(client):
    resp = await client.post("/api/v1/system/ai-engine/test", json={})
    body = resp.json()
    assert resp.status_code == 200
    assert_keys(
        body,
        [
            "success",
            "provider",
            "model",
            "latencyMs",
            "promptTokens",
            "completionTokens",
            "preview",
            "error",
        ],
        "AiEngineTestResult",
    )
    assert isinstance(body["success"], bool)


async def test_emergency_abort_and_resume(client):
    resp = await client.post("/api/v1/system/analysis/abort")
    body = resp.json()
    assert body["analysisPaused"] is True

    queue = (await client.get("/api/v1/results/queue")).json()
    assert queue["analysisPaused"] is True

    # Resume via dedicated runtime endpoint (production path).
    resume = await client.post(
        "/api/v1/system/analysis/pause",
        json={"paused": False},
    )
    assert resume.status_code == 200
    assert resume.json()["analysisPaused"] is False
    queue_after = (await client.get("/api/v1/results/queue")).json()
    assert queue_after["analysisPaused"] is False


async def test_analysis_pause_endpoint(client):
    pause = await client.post("/api/v1/system/analysis/pause", json={"paused": True})
    assert pause.status_code == 200
    assert pause.json()["analysisPaused"] is True

    queue = (await client.get("/api/v1/results/queue")).json()
    assert queue["analysisPaused"] is True

    resume = await client.post("/api/v1/system/analysis/pause", json={"paused": False})
    assert resume.json()["analysisPaused"] is False


async def test_explicit_database_reset_recreates_the_manifest_and_deletes_domain_data(client, app):
    db = app.state.db
    assert await db.fetch_value("SELECT COUNT(*) FROM app_logs") > 0

    response = await client.post("/api/v1/system/reset/database")

    assert response.status_code == 200
    assert response.json() == {"message": "Database reset complete"}
    assert await db.fetch_value("SELECT COUNT(*) FROM app_logs") == 0
    assert await db.fetch_value("PRAGMA user_version") == CURRENT_SCHEMA_VERSION
    assert await inspect_schema(db.conn) == CURRENT_SCHEMA_FINGERPRINT


async def test_retention_run_returns_delete_summary(client, app):
    from server.config import set_configs

    db = app.state.db
    await db.execute(
        "INSERT INTO app_logs (id, time, level, category, kind, message, details) "
        "VALUES (?, ?, 'info', 'system', 'system', 'old', NULL)",
        ("log-retention-run", "2020-01-01T00:00:00+00:00"),
    )
    await set_configs(
        db,
        {
            "retention_messages_days": "0",
            "retention_analysis_days": "0",
            "retention_leaderboard_days": "0",
            "retention_app_logs_days": "1",
            "retention_user_events_days": "0",
        },
    )

    resp = await client.post("/api/v1/system/retention/run")
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["message", "deleted"], "retention run")
    assert_keys(
        body["deleted"],
        [
            "messages",
            "analysis",
            "leaderboard",
            "action_trigger_history",
            "app_logs",
            "user_events",
            "timeline_dismissals",
            "device_access_tokens",
            "device_sessions",
        ],
        "retention deleted",
    )
    assert body["deleted"]["app_logs"] >= 1
    assert await db.fetch_value("SELECT COUNT(*) FROM app_logs WHERE id = 'log-retention-run'") == 0


# ── logs ──────────────────────────────────────────────────────────────────


async def test_logs_page_and_cursor(client):
    resp = await client.get("/api/v1/logs", params={"limit": "2"})
    body = resp.json()
    assert_keys(body, ["logs", "nextCursor", "hasMore", "totalCount"], "logs page")
    assert body["totalCount"] == 3
    assert body["hasMore"] is True
    assert_keys(body["nextCursor"], ["time", "id"], "logs nextCursor")
    for entry in body["logs"]:
        assert_keys(
            entry,
            ["id", "time", "level", "category", "kind", "message", "details"],
            "AppLogEntry",
        )

    page2 = (
        await client.get(
            "/api/v1/logs",
            params={
                "limit": "2",
                "cursor_time": body["nextCursor"]["time"],
                "cursor_id": body["nextCursor"]["id"],
            },
        )
    ).json()
    assert page2["hasMore"] is False
    assert len(page2["logs"]) == 1


async def test_append_log_accepts_frontend_category(client):
    """Quirk #7: errorReporter.ts sends category "frontend"."""
    resp = await client.post(
        "/api/v1/logs",
        json={
            "level": "error",
            "category": "frontend",
            "kind": "frontend.critical",
            "message": "Uncaught TypeError",
            "payload": {"stack": "stack..."},
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["category"] == "frontend"
    assert body["kind"] == "frontend.critical"
    assert_keys(
        body,
        ["id", "time", "level", "category", "kind", "message", "details"],
        "created AppLogEntry",
    )


async def test_append_log_rejects_invalid_level(client):
    """CHECK on app_logs.level must map to 422, not an unhandled 500."""
    resp = await client.post(
        "/api/v1/logs",
        json={
            "level": "DEBUG",
            "category": "system",
            "kind": "system",
            "message": "should fail validation",
        },
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["error_code"] == "VALIDATION_ERROR"
    assert "level" in body["message"]


async def test_logs_page_supports_kind_filters(client, app):
    from server.app_logging import clear_app_logs, record

    db = app.state.db
    await clear_app_logs(db)
    await record(db, level="info", category="analysis", kind="batch.failure", message="fail")
    await record(db, level="info", category="analysis", kind="analysis.trace", message="trace")

    only_fail = (await client.get("/api/v1/logs", params={"kind": "batch.failure"})).json()
    assert only_fail["totalCount"] == 1
    assert only_fail["logs"][0]["kind"] == "batch.failure"

    no_trace = (await client.get("/api/v1/logs", params={"excludeKind": "analysis.trace"})).json()
    assert no_trace["totalCount"] == 1
    assert no_trace["logs"][0]["kind"] == "batch.failure"


async def test_clear_logs(client):
    resp = await client.delete("/api/v1/logs")
    assert resp.status_code == 204
    assert (await client.get("/api/v1/logs")).json()["totalCount"] == 0


# ── health ────────────────────────────────────────────────────────────────


async def test_health_routes(client):
    body = (await client.get("/api/v1/health")).json()
    assert body["status"] == "ok"

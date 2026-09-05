"""Secrets mismatch gate: decrypt probe + 503 SECRETS_UNAVAILABLE + rotate/reset recovery."""

from __future__ import annotations

from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from httpx import ASGITransport, AsyncClient

from server.auth.admin_auth import create_admin_account
from server.config import set_configs
from server.db.database import Database
from server.main import create_app
from server.secrets import _fernet, protect_text
from server.secrets_probe import probe_stored_secrets, scrub_undecryptable_secrets
from server.tests.db_helpers import insert_direct_analysis_task, insert_minimal_source
from server.tests.seed import SEED_LLM_PROFILE_ID, ensure_default_llm_profile
from server.util import utc_now_iso


async def _app_with_db(tmp_path: Path, *, db_name: str = "secrets-gate.db"):
    db_path = tmp_path / db_name
    return create_app(
        db_path=str(db_path),
        start_collector=False,
        start_scheduler=False,
        serve_static=False,
    )


async def _break_key(key_path: Path) -> None:
    _fernet.cache_clear()
    key_path.write_bytes(b"plain:" + Fernet.generate_key())
    _fernet.cache_clear()


async def _set_fixture_profile_api_key(db: Database, api_key: str) -> None:
    await ensure_default_llm_profile(db)
    await db.execute(
        "UPDATE llm_profiles SET api_key = ?, updated_at = ? WHERE id = ?",
        (protect_text(api_key), utc_now_iso(), SEED_LLM_PROFILE_ID),
    )


@pytest.mark.asyncio
async def test_probe_empty_db_is_ready(tmp_path):
    db = Database(str(tmp_path / "empty.db"))
    await db.connect()
    await db.ensure_schema()
    try:
        ready, err = await probe_stored_secrets(db)
        assert ready is True
        assert err is None
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_probe_fails_when_ciphertext_cannot_decrypt(tmp_path, monkeypatch):
    key_path = tmp_path / "secret.key"
    monkeypatch.setenv("INTELLIGENCE_MONITOR_SECRET_KEY_FILE", str(key_path))
    _fernet.cache_clear()

    db = Database(str(tmp_path / "cipher.db"))
    await db.connect()
    await db.ensure_schema()
    try:
        await _set_fixture_profile_api_key(db, "sk-real")
        raw = await db.fetch_value("SELECT api_key FROM llm_profiles WHERE id = ?", (SEED_LLM_PROFILE_ID,))
        assert str(raw).startswith("enc:v1:")

        # Replace key file with a different Fernet key (plain: format for non-DPAPI path).
        await _break_key(key_path)

        ready, err = await probe_stored_secrets(db)
        assert ready is False
        assert err
    finally:
        await db.close()
        _fernet.cache_clear()


@pytest.mark.asyncio
async def test_scrub_clears_ciphertext_keeps_business_rows(tmp_path, monkeypatch):
    key_path = tmp_path / "secret.key"
    monkeypatch.setenv("INTELLIGENCE_MONITOR_SECRET_KEY_FILE", str(key_path))
    _fernet.cache_clear()

    db = Database(str(tmp_path / "scrub.db"))
    await db.connect()
    await db.ensure_schema()
    try:
        await _set_fixture_profile_api_key(db, "sk-real")
        await set_configs(db, {"ui_locale": "zh-Hans"})
        await insert_minimal_source(db, "a1", "email", name="L", credentials=protect_text('{"password":"x"}'))
        await insert_minimal_source(db, "a2", "telegram", name="stale")
        await db.execute(
            "INSERT INTO actions (id, name, action_type, configuration, is_enabled, created_at, updated_at) "
            "VALUES ('act1', 'Hook', 'http_webhook', ?, 1, '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')",
            (protect_text('{"url":"https://example.com"}'),),
        )
        await insert_direct_analysis_task(
            db,
            "t1",
            analysis_mode="leaderboard",
            name="Keep me",
            prompt_template="p",
            schedule_rrule="FREQ=SECONDLY;INTERVAL=10",
        )

        counts = await scrub_undecryptable_secrets(db)
        assert counts["llm_profiles"] == 1
        assert counts["sources"] == 1
        assert counts["stale_connected"] == 1
        assert counts["actions"] == 1

        assert await db.fetch_value("SELECT api_key FROM llm_profiles WHERE id = ?", (SEED_LLM_PROFILE_ID,)) == ""
        assert await db.fetch_value("SELECT value FROM system_config WHERE key = 'ui_locale'") == "zh-Hans"
        assert await db.fetch_value("SELECT credentials FROM sources WHERE id = 'a1'") is None
        assert await db.fetch_value("SELECT status FROM sources WHERE id = 'a1'") == "disconnected"
        assert await db.fetch_value("SELECT status FROM sources WHERE id = 'a2'") == "disconnected"
        assert await db.fetch_value("SELECT configuration FROM actions WHERE id = 'act1'") == "{}"
        assert await db.fetch_value("SELECT name FROM analysis_tasks WHERE id = 't1'") == "Keep me"

        ready, err = await probe_stored_secrets(db)
        assert ready is True
        assert err is None
    finally:
        await db.close()
        _fernet.cache_clear()


@pytest.mark.asyncio
async def test_secrets_gate_blocks_then_rotate_unlocks(tmp_path, monkeypatch):
    key_path = tmp_path / "secret.key"
    monkeypatch.setenv("INTELLIGENCE_MONITOR_SECRET_KEY_FILE", str(key_path))
    _fernet.cache_clear()

    app1 = await _app_with_db(tmp_path, db_name="rotate.db")
    async with app1.router.lifespan_context(app1):
        assert app1.state.secrets_ready is True
        await create_admin_account(app1.state.db, username="admin", password="password1")
        await _set_fixture_profile_api_key(app1.state.db, "sk-keep")
        await insert_direct_analysis_task(
            app1.state.db,
            "t-keep",
            analysis_mode="leaderboard",
            name="Keep Task",
            prompt_template="p",
            schedule_rrule="FREQ=SECONDLY;INTERVAL=10",
        )
        transport = ASGITransport(app=app1)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            health = await client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["secretsReady"] is True

    await _break_key(key_path)

    app2 = await _app_with_db(tmp_path, db_name="rotate.db")
    async with app2.router.lifespan_context(app2):
        assert app2.state.secrets_ready is False
        transport = ASGITransport(app=app2)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            blocked = await client.get("/api/v1/results/events")
            assert blocked.status_code == 503
            assert blocked.json()["error_code"] == "SECRETS_UNAVAILABLE"

            bad = await client.post(
                "/api/v1/system/rotate-secrets",
                json={"username": "admin", "password": "wrong"},
            )
            assert bad.status_code == 401
            assert bad.json()["error_code"] == "INVALID_CREDENTIALS"
            assert app2.state.secrets_ready is False

            rotate = await client.post(
                "/api/v1/system/rotate-secrets",
                json={"username": "admin", "password": "password1"},
            )
            assert rotate.status_code == 200
            body = rotate.json()
            assert body["message"] == "Secrets rotated"
            assert body["secretsReady"] is True
            assert body["scrubbed"]["llm_profiles"] >= 1

            health2 = await client.get("/api/v1/health")
            assert health2.status_code == 200
            assert health2.json()["secretsReady"] is True
            assert app2.state.secrets_ready is True

            events = await client.get("/api/v1/results/events")
            assert events.status_code == 200

            task_name = await app2.state.db.fetch_value("SELECT name FROM analysis_tasks WHERE id = 't-keep'")
            assert task_name == "Keep Task"
            admin = await app2.state.db.fetch_value("SELECT username FROM admin_accounts WHERE username = 'admin'")
            assert admin == "admin"
            cipher = await app2.state.db.fetch_value(
                "SELECT api_key FROM llm_profiles WHERE id = ?",
                (SEED_LLM_PROFILE_ID,),
            )
            assert cipher == ""

            # Already ready → reject further rotate.
            again = await client.post(
                "/api/v1/system/rotate-secrets",
                json={"username": "admin", "password": "password1"},
            )
            assert again.status_code == 409


@pytest.mark.asyncio
async def test_secrets_gate_blocks_then_reset_unlocks(tmp_path, monkeypatch):
    key_path = tmp_path / "secret.key"
    monkeypatch.setenv("INTELLIGENCE_MONITOR_SECRET_KEY_FILE", str(key_path))
    _fernet.cache_clear()

    # First lifespan: write ciphertext with key A.
    app1 = await _app_with_db(tmp_path, db_name="gate.db")
    async with app1.router.lifespan_context(app1):
        assert app1.state.secrets_ready is True
        await _set_fixture_profile_api_key(app1.state.db, "sk-keep")
        health = None
        transport = ASGITransport(app=app1)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            health = await client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["secretsReady"] is True

    # Swap to key B so startup probe fails.
    await _break_key(key_path)

    app2 = await _app_with_db(tmp_path, db_name="gate.db")
    async with app2.router.lifespan_context(app2):
        assert app2.state.secrets_ready is False
        transport = ASGITransport(app=app2)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            health = await client.get("/api/v1/health")
            assert health.status_code == 200
            body = health.json()
            assert body["secretsReady"] is False
            assert body["runtimeReady"] is True
            assert "secretsError" in body

            setup = await client.get("/api/v1/setup/status")
            assert setup.status_code == 200

            blocked = await client.get("/api/v1/results/events")
            assert blocked.status_code == 503
            blocked_body = blocked.json()
            assert blocked_body["error_code"] == "SECRETS_UNAVAILABLE"
            assert blocked_body["details"]["secretsReady"] is False

            # Reset without auth while secrets are broken.
            reset = await client.post("/api/v1/system/reset/database")
            assert reset.status_code == 200
            assert reset.json() == {"message": "Database reset complete"}

            health2 = await client.get("/api/v1/health")
            assert health2.status_code == 200
            assert health2.json()["secretsReady"] is True
            assert app2.state.secrets_ready is True

            # Business API is usable again (loopback auth exempt).
            events = await client.get("/api/v1/results/events")
            assert events.status_code == 200


@pytest.mark.asyncio
async def test_secret_protection_error_maps_to_503(tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from server.errors import register_error_handlers
    from server.secrets import SecretProtectionError

    app = FastAPI()
    register_error_handlers(app)

    @app.get("/boom")
    async def boom() -> None:
        raise SecretProtectionError("cannot decrypt")

    with TestClient(app) as client:
        resp = client.get("/boom")
    assert resp.status_code == 503
    assert resp.json()["error_code"] == "SECRETS_UNAVAILABLE"


@pytest.mark.asyncio
async def test_health_includes_secrets_ready_on_fresh_app(client, app):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["secretsReady"] is True
    assert "runtimeReady" in body


@pytest.mark.asyncio
async def test_probe_sources_ciphertext(tmp_path, monkeypatch):
    key_path = tmp_path / "secret.key"
    monkeypatch.setenv("INTELLIGENCE_MONITOR_SECRET_KEY_FILE", str(key_path))
    _fernet.cache_clear()

    db = Database(str(tmp_path / "sources.db"))
    await db.connect()
    await db.ensure_schema()
    try:
        cipher = protect_text('{"password":"x"}')
        await insert_minimal_source(db, "a1", "email", name="L", status="disconnected", credentials=cipher)
        ready, err = await probe_stored_secrets(db)
        assert ready is True
        assert err is None

        await _break_key(key_path)
        ready2, err2 = await probe_stored_secrets(db)
        assert ready2 is False
        assert err2
    finally:
        await db.close()
        _fernet.cache_clear()

"""Secret encryption at rest."""

from __future__ import annotations

import json

import server.secrets as secret_store
from server.config import get_config, set_configs
from server.db.database import Database


def test_secret_roundtrip_is_not_plaintext():
    protected = secret_store.protect_text("super-secret-value")

    assert protected.startswith("enc:v1:")
    assert "super-secret-value" not in protected
    assert secret_store.unprotect_text(protected) == "super-secret-value"


async def test_config_secrets_are_encrypted_transparently(tmp_path):
    db = Database(str(tmp_path / "config-secrets.db"))
    await db.connect()
    await db.ensure_schema()
    try:
        await set_configs(db, {"openai_api_key": "sk-test"})
        raw = await db.fetch_value("SELECT value FROM system_config WHERE key = 'openai_api_key'")
        assert str(raw).startswith("enc:v1:")
        assert await get_config(db, "openai_api_key") == "sk-test"
    finally:
        await db.close()


async def test_email_credentials_are_encrypted_on_create(client, app):
    resp = await client.post(
        "/api/v1/sources/email",
        json={
            "imapHost": "imap.gmail.com",
            "username": "user@gmail.com",
            "password": "imap-app-password",
            "folders": ["INBOX"],
        },
    )
    assert resp.status_code == 200
    source_id = resp.json()["source"]["id"]
    raw = await app.state.db.fetch_value("SELECT credentials FROM sources WHERE id = ?", (source_id,))
    assert str(raw).startswith("enc:v1:")
    assert "imap-app-password" not in str(raw)
    creds = json.loads(secret_store.unprotect_text(raw))
    assert creds["password"] == "imap-app-password"

"""Secret encryption at rest."""

from __future__ import annotations

import json

import server.secrets as secret_store
from server.db.database import Database
from server.secrets import protect_text
from server.tests.seed import SEED_LLM_PROFILE_ID, ensure_default_llm_profile
from server.util import utc_now_iso


def test_secret_roundtrip_is_not_plaintext():
    protected = secret_store.protect_text("super-secret-value")

    assert protected.startswith("enc:v1:")
    assert "super-secret-value" not in protected
    assert secret_store.unprotect_text(protected) == "super-secret-value"


async def test_llm_profile_secrets_are_encrypted_transparently(tmp_path):
    db = Database(str(tmp_path / "profile-secrets.db"))
    await db.connect()
    await db.ensure_schema()
    try:
        # Schema no longer bootstraps a default profile; create one to update.
        await ensure_default_llm_profile(db)
        await db.execute(
            "UPDATE llm_profiles SET api_key = ?, updated_at = ? WHERE id = ?",
            (protect_text("sk-test"), utc_now_iso(), SEED_LLM_PROFILE_ID),
        )
        raw = await db.fetch_value("SELECT api_key FROM llm_profiles WHERE id = ?", (SEED_LLM_PROFILE_ID,))
        assert str(raw).startswith("enc:v1:")
        assert secret_store.unprotect_text(raw) == "sk-test"
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

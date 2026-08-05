"""Contract keys: email IMAP source routes."""

from __future__ import annotations

import json

from server.secrets import unprotect_text
from server.tests import seed
from server.tests.contract_helpers import assert_keys

EMAIL_MAILBOX_INFO_KEYS = [
    "source",
    "imapHost",
    "imapPort",
    "useSsl",
    "username",
    "folders",
    "pollIntervalSeconds",
    "initialSyncDays",
    "initialSyncMaxMessages",
    "senderAllowlist",
    "markAsRead",
    "folderCursors",
    "channels",
    "lastError",
    "lastSuccessAt",
]


async def test_list_sources_email_is_mailboxinfo(client):
    resp = await client.get("/api/v1/sources/email")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    mailbox = body[0]
    assert_keys(mailbox, EMAIL_MAILBOX_INFO_KEYS, "EmailMailboxInfo")
    assert mailbox["source"]["id"] == seed.EMAIL_SOURCE
    assert mailbox["imapHost"] == "imap.example.com"
    assert mailbox["username"] == seed.EMAIL_USERNAME
    assert mailbox["folders"] == ["INBOX"]
    assert mailbox["pollIntervalSeconds"] == 300
    assert mailbox["folderCursors"] == {"INBOX": 5}
    assert isinstance(mailbox["channels"], list) and mailbox["channels"]
    for channel in mailbox["channels"]:
        assert_keys(channel, ["id", "platform", "channelName"], "EmailMailboxInfo.channels[]")


async def test_create_email_mailbox_response_shape(client, app):
    resp = await client.post(
        "/api/v1/sources/email",
        json={
            "imapHost": "imap.gmail.com",
            "imapPort": 993,
            "useSsl": True,
            "username": "user@gmail.com",
            "password": "app-password",
            "folders": ["INBOX"],
            "pollIntervalSeconds": 300,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["source", "status", "errorMessage", "channels"], "AddEmailMailboxResponse")
    assert body["status"] == "error"  # no collector in tests
    assert body["source"]["platform"] == "email"

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM sources WHERE id = ?",
        (body["source"]["id"],),
    )
    assert str(stored).startswith("enc:v1:")
    creds = json.loads(unprotect_text(stored))
    assert creds["password"] == "app-password"
    assert "app-password" not in str(stored)


async def test_patch_email_mailbox_preserves_password_mask(client, app):
    create = await client.post(
        "/api/v1/sources/email",
        json={
            "imapHost": "imap.gmail.com",
            "username": "user@gmail.com",
            "password": "secret-token",
            "folders": ["INBOX"],
        },
    )
    source_id = create.json()["source"]["id"]

    patch = await client.patch(
        f"/api/v1/sources/email/{source_id}",
        json={
            "pollIntervalSeconds": 600,
            "password": "********",
            "resetCursors": True,
        },
    )
    assert patch.status_code == 200
    body = patch.json()
    assert_keys(
        body,
        ["source", "status", "errorMessage", "channels"],
        "PatchEmailMailboxResponse",
    )

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM sources WHERE id = ?",
        (source_id,),
    )
    creds = json.loads(unprotect_text(stored))
    assert creds["password"] == "secret-token"
    assert creds["poll_interval_seconds"] == 600
    assert creds["folder_cursors"] == {}

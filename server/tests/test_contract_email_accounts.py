"""Contract keys: email IMAP account routes."""

from __future__ import annotations

import json

from server.secrets import unprotect_text
from server.tests import seed
from server.tests.contract_helpers import assert_keys

EMAIL_MAILBOX_INFO_KEYS = [
    "account",
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


async def test_list_accounts_email_is_mailboxinfo(client):
    resp = await client.get("/api/v1/accounts/email")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    mailbox = body[0]
    assert_keys(mailbox, EMAIL_MAILBOX_INFO_KEYS, "EmailMailboxInfo")
    assert mailbox["account"]["id"] == seed.EMAIL_ACCOUNT
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
        "/api/v1/accounts/email",
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
    assert_keys(body, ["account", "status", "errorMessage", "channels"], "AddEmailMailboxResponse")
    assert body["status"] == "error"  # no collector in tests
    assert body["account"]["platform"] == "email"

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM accounts WHERE id = ?",
        (body["account"]["id"],),
    )
    assert str(stored).startswith("enc:v1:")
    creds = json.loads(unprotect_text(stored))
    assert creds["password"] == "app-password"
    assert "app-password" not in str(stored)


async def test_patch_email_mailbox_preserves_password_mask(client, app):
    create = await client.post(
        "/api/v1/accounts/email",
        json={
            "imapHost": "imap.gmail.com",
            "username": "user@gmail.com",
            "password": "secret-token",
            "folders": ["INBOX"],
        },
    )
    account_id = create.json()["account"]["id"]

    patch = await client.patch(
        f"/api/v1/accounts/email/{account_id}",
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
        ["account", "status", "errorMessage", "channels"],
        "PatchEmailMailboxResponse",
    )

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM accounts WHERE id = ?",
        (account_id,),
    )
    creds = json.loads(unprotect_text(stored))
    assert creds["password"] == "secret-token"
    assert creds["poll_interval_seconds"] == 600
    assert creds["folder_cursors"] == {}

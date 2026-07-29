"""Contract keys: RSS and MQTT account PATCH routes."""

from __future__ import annotations

import json

from server.secrets import unprotect_text
from server.tests.contract_helpers import assert_keys

RSS_FEED_INFO_KEYS = [
    "account",
    "feedUrl",
    "pollIntervalSeconds",
    "channel",
    "lastError",
    "lastSuccessAt",
]


async def test_list_accounts_rss_includes_poll_interval(client):
    resp = await client.get("/api/v1/accounts/rss")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    feed = body[0]
    assert_keys(feed, RSS_FEED_INFO_KEYS, "RssFeedInfo")
    assert feed["pollIntervalSeconds"] == 300


async def test_patch_rss_feed_updates_poll_interval(client, app, monkeypatch):
    from server.tests.test_contract_accounts import _stub_collector

    _stub_collector(app, monkeypatch)
    create = await client.post(
        "/api/v1/accounts/rss",
        json={
            "feedUrl": "https://example.com/patch-feed.xml",
            "pollIntervalSeconds": 300,
        },
    )
    account_id = create.json()["account"]["id"]

    patch = await client.patch(
        f"/api/v1/accounts/rss/{account_id}",
        json={"pollIntervalSeconds": 600, "name": "Patched Feed"},
    )
    assert patch.status_code == 200
    body = patch.json()
    assert_keys(
        body,
        ["account", "channel", "feedTitle", "status", "errorMessage"],
        "PatchRssFeedResponse",
    )

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM accounts WHERE id = ?",
        (account_id,),
    )
    creds = json.loads(unprotect_text(stored))
    assert creds["poll_interval_seconds"] == 600


async def test_patch_mqtt_broker_preserves_password_mask(client, app, monkeypatch):
    from server.tests.test_contract_accounts import _stub_collector

    _stub_collector(app, monkeypatch)
    create = await client.post(
        "/api/v1/accounts/mqtt",
        json={
            "brokerUrl": "mqtt://broker.example.com:1883",
            "topics": ["sensors/#"],
            "password": "secret-mqtt",
        },
    )
    account_id = create.json()["account"]["id"]

    patch = await client.patch(
        f"/api/v1/accounts/mqtt/{account_id}",
        json={
            "topics": ["sensors/temp", "sensors/humidity"],
            "password": "********",
        },
    )
    assert patch.status_code == 200
    body = patch.json()
    assert_keys(
        body,
        ["account", "status", "errorMessage"],
        "PatchMqttBrokerResponse",
    )

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM accounts WHERE id = ?",
        (account_id,),
    )
    creds = json.loads(unprotect_text(stored))
    assert creds["password"] == "secret-mqtt"
    assert creds["topics"] == ["sensors/temp", "sensors/humidity"]

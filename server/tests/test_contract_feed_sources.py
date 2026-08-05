"""Contract keys: RSS and MQTT source PATCH routes."""

from __future__ import annotations

import json

from server.secrets import unprotect_text
from server.tests.contract_helpers import assert_keys

RSS_FEED_INFO_KEYS = [
    "source",
    "feedUrl",
    "pollIntervalSeconds",
    "channel",
    "lastError",
    "lastSuccessAt",
]


async def test_list_sources_rss_includes_poll_interval(client):
    resp = await client.get("/api/v1/sources/rss")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    feed = body[0]
    assert_keys(feed, RSS_FEED_INFO_KEYS, "RssFeedInfo")
    assert feed["pollIntervalSeconds"] == 300


async def test_patch_rss_feed_updates_poll_interval(client, app, monkeypatch):
    from server.tests.test_contract_sources import _stub_collector

    _stub_collector(app, monkeypatch)
    create = await client.post(
        "/api/v1/sources/rss",
        json={
            "feedUrl": "https://example.com/patch-feed.xml",
            "pollIntervalSeconds": 300,
        },
    )
    source_id = create.json()["source"]["id"]

    patch = await client.patch(
        f"/api/v1/sources/rss/{source_id}",
        json={"pollIntervalSeconds": 600, "name": "Patched Feed"},
    )
    assert patch.status_code == 200
    body = patch.json()
    assert_keys(
        body,
        ["source", "channel", "feedTitle", "status", "errorMessage"],
        "PatchRssFeedResponse",
    )

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM sources WHERE id = ?",
        (source_id,),
    )
    creds = json.loads(unprotect_text(stored))
    assert creds["poll_interval_seconds"] == 600


async def test_patch_mqtt_broker_preserves_password_mask(client, app, monkeypatch):
    from server.tests.test_contract_sources import _stub_collector

    _stub_collector(app, monkeypatch)
    create = await client.post(
        "/api/v1/sources/mqtt",
        json={
            "brokerUrl": "mqtt://broker.example.com:1883",
            "topics": ["sensors/#"],
            "password": "secret-mqtt",
        },
    )
    source_id = create.json()["source"]["id"]

    patch = await client.patch(
        f"/api/v1/sources/mqtt/{source_id}",
        json={
            "topics": ["sensors/temp", "sensors/humidity"],
            "password": "********",
        },
    )
    assert patch.status_code == 200
    body = patch.json()
    assert_keys(
        body,
        ["source", "status", "errorMessage"],
        "PatchMqttBrokerResponse",
    )

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM sources WHERE id = ?",
        (source_id,),
    )
    creds = json.loads(unprotect_text(stored))
    assert creds["password"] == "secret-mqtt"
    assert creds["topics"] == ["sensors/temp", "sensors/humidity"]

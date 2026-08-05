"""Contract keys: sources & sources routes."""

from __future__ import annotations

import json
from types import SimpleNamespace

from server.secrets import MASKED_SECRET, unprotect_text
from server.tests import seed
from server.tests.contract_helpers import assert_keys

HTTP_SOURCE_INFO_KEYS = [
    "source",
    "channel",
    "url",
    "method",
    "authType",
    "bearerToken",
    "basicUsername",
    "basicPassword",
    "headers",
    "bodyType",
    "body",
    "pollIntervalSeconds",
    "maxContentChars",
    "timeoutSeconds",
    "lastError",
    "lastSuccessAt",
]


class _StubCollector:
    """Minimal collector mock for create/reconnect contract tests."""

    def __init__(
        self,
        *,
        reconnect_result: dict | None = None,
        reconnect_error: str | None = None,
    ) -> None:
        self.adapters: dict[str, object] = {}
        self._reconnect_result = reconnect_result
        self._reconnect_error = reconnect_error

    async def reconnect_source(self, source_id: str) -> dict:
        if self._reconnect_result is not None:
            if self._reconnect_error is not None:
                self.adapters[source_id] = SimpleNamespace(state=SimpleNamespace(last_error=self._reconnect_error))
            return self._reconnect_result
        return {"connected": True, "status": "connected"}

    async def create_discord_bot(self, _host: object, source_id: str, bot_token: str) -> dict:
        return {
            "channels": [
                {"id": "30001", "name": "general", "guild_name": "Test Guild"},
            ],
        }

    async def update_discord_bot(self, _host: object, source_id: str, credentials: dict) -> dict:
        return await self.create_discord_bot(_host, source_id, str(credentials.get("bot_token") or ""))

    async def create_rss_feed(
        self,
        _host: object,
        source_id: str,
        feed_url: str,
        poll_interval_seconds: int = 300,
    ) -> dict:
        return {"feed_title": "New Feed"}

    async def update_rss_feed(self, _host: object, source_id: str, credentials: dict) -> dict:
        return {"feed_title": "Patched Feed"}

    async def create_http_source(self, _host: object, source_id: str, credentials: dict) -> dict:
        return {"status": "connected"}

    async def update_http_source(self, _host: object, source_id: str, credentials: dict) -> dict:
        return {"status": "connected"}

    async def create_mqtt_broker(
        self,
        _host: object,
        source_id: str,
        broker_url: str,
        topics: list[str],
        username: str | None = None,
        password: str | None = None,
        client_id: str | None = None,
    ) -> dict:
        return {}

    async def update_mqtt_broker(self, _host: object, source_id: str, credentials: dict) -> dict:
        return {"status": "connected"}

    def install_source_stubs(self, monkeypatch) -> None:
        """Route source create/update through this stub via manager_sources."""
        for name in (
            "create_discord_bot",
            "update_discord_bot",
            "create_rss_feed",
            "update_rss_feed",
            "create_http_source",
            "update_http_source",
            "create_mqtt_broker",
            "update_mqtt_broker",
        ):
            monkeypatch.setattr(f"server.collector.manager_sources.{name}", getattr(self, name))


def _stub_collector(app, monkeypatch, **kwargs) -> _StubCollector:
    stub = _StubCollector(**kwargs)
    stub.install_source_stubs(monkeypatch)
    app.state.collector = stub
    return stub


async def test_list_sources_default(client):
    resp = await client.get("/api/v1/sources")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 5
    for source in body:
        assert_keys(
            source,
            ["id", "platform", "name", "status", "lastError", "updatedAt"],
            "GET /sources item",
        )


def test_source_list_openapi_uses_concrete_item_models(app):
    schema = app.openapi()
    expected = {
        "/api/v1/sources": "SourceResponse",
        "/api/v1/sources/telegram": "SourceResponse",
        "/api/v1/sources/discord": "DiscordBotInfoResponse",
        "/api/v1/sources/rss": "RssFeedInfoResponse",
        "/api/v1/sources/http": "HttpSourceInfoResponse",
        "/api/v1/sources/mqtt": "MqttBrokerInfoResponse",
        "/api/v1/sources/email": "EmailMailboxInfoResponse",
    }
    for path, model_name in expected.items():
        response_schema = schema["paths"][path]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        assert response_schema["type"] == "array", path
        assert response_schema["items"]["$ref"] == f"#/components/schemas/{model_name}", path


async def test_list_sources_platform_query_rejected(client):
    resp = await client.get("/api/v1/sources", params={"platform": "telegram"})
    assert resp.status_code == 400


async def test_list_sources_telegram_has_name(client):
    resp = await client.get("/api/v1/sources/telegram")
    body = resp.json()
    assert len(body) == 1
    source = body[0]
    assert source["name"] == "+886912345678"


async def test_list_sources_discord_is_botinfo(client):
    resp = await client.get("/api/v1/sources/discord")
    body = resp.json()
    assert len(body) == 1
    bot = body[0]
    assert_keys(bot, ["source", "channels"], "DiscordBotInfo")
    assert_keys(
        bot["source"],
        ["id", "status", "name"],
        "DiscordBotInfo.source",
    )
    assert isinstance(bot["channels"], list) and bot["channels"]
    for channel in bot["channels"]:
        assert_keys(
            channel,
            ["platformChannelId", "name", "guildName"],
            "DiscordChannelInfo",
        )


async def test_list_sources_rss_is_feedinfo(client):
    resp = await client.get("/api/v1/sources/rss")
    body = resp.json()
    assert len(body) == 1
    feed = body[0]
    assert_keys(
        feed,
        ["source", "feedUrl", "pollIntervalSeconds", "channel", "lastError", "lastSuccessAt"],
        "RssFeedInfo",
    )
    assert feed["feedUrl"] == seed.RSS_CHANNEL[1]
    assert feed["channel"] is not None
    assert_keys(
        feed["channel"],
        ["id", "platform", "platformId", "channelName"],
        "RssFeedInfo.channel",
    )
    assert_keys(
        feed["source"],
        ["id", "status", "name", "lastError", "updatedAt"],
        "RssFeedInfo.source",
    )


async def test_list_sources_mqtt_is_brokerinfo(client):
    resp = await client.get("/api/v1/sources/mqtt")
    body = resp.json()
    assert len(body) == 1
    broker = body[0]
    assert_keys(
        broker,
        ["source", "brokerUrl", "topics", "lastError", "lastSuccessAt"],
        "MqttBrokerInfo",
    )
    assert broker["brokerUrl"] == seed.MQTT_CHANNEL[1]
    assert broker["topics"] == ["news/#", "alerts/hk"]
    assert_keys(
        broker["source"],
        ["id", "status", "name"],
        "MqttBrokerInfo.source",
    )


async def test_refresh_all(client):
    resp = await client.post("/api/v1/sources/refresh-all")
    assert resp.status_code == 200
    assert_keys(
        resp.json(),
        [
            "totalSources",
            "connectedCount",
            "verificationRequiredCount",
            "errorCount",
            "verificationRequiredSourceIds",
            "errorSourceIds",
        ],
        "refresh-all",
    )


async def test_reconnect_source_response_and_db_status(client, app):
    db = app.state.db
    await db.execute(
        "UPDATE sources SET status = 'error', last_error = 'stale error' WHERE id = ?",
        (seed.DISCORD_SOURCE,),
    )
    app.state.collector = _StubCollector(reconnect_result={"connected": True, "status": "connected"})

    resp = await client.post(f"/api/v1/sources/{seed.DISCORD_SOURCE}/reconnect")
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["nextStep", "source"], "AddSourceResponse")
    assert body["nextStep"] == "connected"
    assert body["source"]["status"] == "connected"
    assert body["source"]["lastError"] is None

    row = await db.fetch_one("SELECT status, last_error FROM sources WHERE id = ?", (seed.DISCORD_SOURCE,))
    assert row["status"] == "connected"
    assert row["last_error"] is None


async def test_reconnect_source_failure_persists_error(client, app):
    db = app.state.db
    app.state.collector = _StubCollector(
        reconnect_result={"connected": False, "status": "error"},
        reconnect_error="token revoked",
    )

    resp = await client.post(f"/api/v1/sources/{seed.RSS_SOURCE}/reconnect")
    assert resp.status_code == 200
    body = resp.json()
    assert body["nextStep"] == "error"
    assert body["source"]["status"] == "error"
    assert body["source"]["lastError"] == "token revoked"

    row = await db.fetch_one("SELECT status, last_error FROM sources WHERE id = ?", (seed.RSS_SOURCE,))
    assert row["status"] == "error"
    assert row["last_error"] == "token revoked"


async def test_create_discord_bot_response_shape(client, app, monkeypatch):
    _stub_collector(app, monkeypatch)
    resp = await client.post(
        "/api/v1/sources/discord",
        json={"botToken": "discord-test-token"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["source", "channels", "status", "errorMessage"], "AddDiscordBotResponse")
    assert body["status"] == "connected"
    assert body["channels"]
    for channel in body["channels"]:
        assert_keys(channel, ["id", "name", "platformChannelId", "guildName"], "DiscordChannelInfo")


async def test_create_rss_feed_response_shape(client, app, monkeypatch):
    _stub_collector(app, monkeypatch)
    feed_url = "https://example.com/new-feed.xml"
    resp = await client.post(
        "/api/v1/sources/rss",
        json={"feedUrl": feed_url, "name": "New Feed"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["source", "channel", "feedTitle", "status", "errorMessage"], "AddRssFeedResponse")
    assert body["status"] == "connected"
    assert body["feedTitle"] == "New Feed"
    assert body["channel"] is not None

    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM sources WHERE id = ?",
        (body["source"]["id"],),
    )
    creds = json.loads(unprotect_text(stored))
    assert creds["poll_interval_seconds"] == 300


async def test_http_source_create_list_and_patch_contract(client, app, monkeypatch):
    _stub_collector(app, monkeypatch)
    created = await client.post(
        "/api/v1/sources/http",
        json={
            "url": "https://example.com/api/events",
            "name": "Events API",
            "authType": "bearer",
            "bearerToken": "http-secret-token",
            "headers": {"X-Source": "contract"},
            "pollIntervalSeconds": 120,
        },
    )
    assert created.status_code == 200
    created_body = created.json()
    assert_keys(
        created_body,
        [*HTTP_SOURCE_INFO_KEYS, "status", "errorMessage"],
        "AddHttpSourceResponse",
    )
    assert created_body["bearerToken"] == MASKED_SECRET
    assert created_body["status"] == "connected"
    source_id = created_body["source"]["id"]

    listed = await client.get("/api/v1/sources/http")
    assert listed.status_code == 200
    item = next(source for source in listed.json() if source["source"]["id"] == source_id)
    assert_keys(item, HTTP_SOURCE_INFO_KEYS, "HttpSourceInfo")
    assert item["bearerToken"] == MASKED_SECRET
    assert item["headers"] == {"X-Source": "contract"}

    patched = await client.patch(
        f"/api/v1/sources/http/{source_id}",
        json={
            "method": "POST",
            "bodyType": "json",
            "body": '{"probe": true}',
            "bearerToken": MASKED_SECRET,
        },
    )
    assert patched.status_code == 200
    patched_body = patched.json()
    assert_keys(
        patched_body,
        [*HTTP_SOURCE_INFO_KEYS, "status", "errorMessage"],
        "AddHttpSourceResponse",
    )
    assert patched_body["method"] == "POST"
    assert patched_body["bearerToken"] == MASKED_SECRET


async def test_create_mqtt_broker_response_shape(client, app, monkeypatch):
    _stub_collector(app, monkeypatch)
    resp = await client.post(
        "/api/v1/sources/mqtt",
        json={"brokerUrl": "mqtt://localhost:1883", "topics": ["news/#"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["source", "status", "errorMessage"], "AddMqttBrokerResponse")
    assert body["status"] == "connected"
    assert body["errorMessage"] is None


async def test_create_telegram_source_response_shape(client, app):
    """Without a collector the login fails, but the response shape must hold."""
    resp = await client.post(
        "/api/v1/sources/telegram",
        json={"apiId": 111, "apiHash": "abc", "phone": "+886900000000"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["nextStep", "source"], "AddSourceResponse")
    assert body["source"]["id"]
    assert body["nextStep"] == "error"  # no collector in tests
    stored = await app.state.db.fetch_value(
        "SELECT credentials FROM sources WHERE id = ?",
        (body["source"]["id"],),
    )
    assert str(stored).startswith("enc:v1:")
    assert "abc" not in str(stored)


async def test_create_telegram_qr_source_response_shape(client, app):
    """Without a collector QR start fails, but the response shape must hold."""
    resp = await client.post(
        "/api/v1/sources/telegram/qr",
        json={"apiId": 111, "apiHash": "abc"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["nextStep", "source"], "AddSourceResponse")
    assert body["source"]["id"]
    assert body["source"]["name"] == "Telegram"
    assert body["nextStep"] == "error"


async def test_telegram_qr_wait_and_success_shape(client, app):
    class _QrCollector:
        async def start_telegram_qr_login(self, source_id: str, api_id: int, api_hash: str) -> dict:
            assert api_id == 222
            assert api_hash == "hash"
            return {
                "next_step": "qr_required",
                "qr_url": "tg://login?token=abc",
                "qr_expires_at": "2026-07-26T12:00:00Z",
            }

        async def wait_telegram_qr_login(self, source_id: str, timeout: float | None = None) -> dict:
            assert timeout == 20
            return {"next_step": "connected"}

    app.state.collector = _QrCollector()
    create_resp = await client.post(
        "/api/v1/sources/telegram/qr",
        json={"apiId": 222, "apiHash": "hash"},
    )
    assert create_resp.status_code == 200
    create_body = create_resp.json()
    assert create_body["nextStep"] == "qr_required"
    assert create_body["pendingLoginStage"] == "qr_required"
    assert create_body["qrUrl"] == "tg://login?token=abc"
    assert create_body["qrExpiresAt"] == "2026-07-26T12:00:00Z"
    source_id = create_body["source"]["id"]

    wait_resp = await client.post(
        f"/api/v1/sources/telegram/{source_id}/qr-wait",
        json={"timeoutSeconds": 20},
    )
    assert wait_resp.status_code == 200
    wait_body = wait_resp.json()
    assert wait_body["nextStep"] == "connected"
    assert wait_body["source"]["id"] == source_id


async def test_delete_source(client):
    resp = await client.delete(f"/api/v1/sources/{seed.MQTT_SOURCE}")
    assert resp.status_code == 204

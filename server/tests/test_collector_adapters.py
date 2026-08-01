"""Collector layer unit + smoke tests: backoff policy, adapter factory
dispatch, base-adapter ingest/reconnect behavior, and per-adapter
connect → ingest → disconnect smoke paths with mocked external I/O."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import AsyncIterator

import pytest

from server.collector.adapter_factory import build_adapter
from server.collector.backoff import BASE_DELAY_SECONDS, MAX_DELAY_SECONDS, next_delay
from server.collector.base import BasePlatformAdapter
from server.collector.mqtt import MqttAdapter
from server.collector.rss import RssAdapter
from server.db.database import Database
from server.sse import SseBroadcaster
from server.tests.db_helpers import insert_minimal_account


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "collector-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


@pytest.fixture
def broadcaster() -> SseBroadcaster:
    return SseBroadcaster()


def _drain_events(queue) -> list[dict]:
    events = []
    while True:
        try:
            raw = queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        events.append({"event": raw["event"], "payload": json.loads(raw["data"])["payload"]})
    return events


# ── backoff policy ──────────────────────────────────────────────────────────


def test_backoff_starts_at_base():
    assert next_delay(None) == BASE_DELAY_SECONDS
    assert next_delay(0) == BASE_DELAY_SECONDS
    assert next_delay(-1) == BASE_DELAY_SECONDS


def test_backoff_doubles_until_cap():
    delays = []
    delay = None
    for _ in range(10):
        delay = next_delay(delay)
        delays.append(delay)
    assert delays[:7] == [1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 60.0]
    assert delays[-1] == MAX_DELAY_SECONDS


def test_backoff_respects_custom_base_and_cap():
    assert next_delay(None, base=0.5, cap=2.0) == 0.5
    assert next_delay(0.5, base=0.5, cap=2.0) == 1.0
    assert next_delay(2.0, base=0.5, cap=2.0) == 2.0


# ── adapter factory dispatch ────────────────────────────────────────────────


def test_factory_unsupported_platform_returns_none(db, broadcaster, tmp_path):
    adapter = build_adapter("a-1", "carrier-pigeon", {}, db=db, broadcaster=broadcaster, session_dir=str(tmp_path))
    assert adapter is None


def test_factory_missing_credentials_return_none(db, broadcaster, tmp_path):
    session_dir = str(tmp_path)
    from server.domain.collector_platforms import COLLECTOR_PLATFORMS

    for platform in COLLECTOR_PLATFORMS:
        adapter = build_adapter("a-1", platform, {}, db=db, broadcaster=broadcaster, session_dir=session_dir)
        assert adapter is None, platform


def test_factory_builds_rss_adapter(db, broadcaster, tmp_path):
    adapter = build_adapter(
        "a-1",
        "rss",
        {"feed_url": "https://example.com/feed.xml"},
        db=db,
        broadcaster=broadcaster,
        session_dir=str(tmp_path),
    )
    assert isinstance(adapter, RssAdapter)
    assert adapter.state.platform == "rss"


def test_factory_builds_mqtt_adapter_with_string_topics(db, broadcaster, tmp_path):
    adapter = build_adapter(
        "a-1",
        "mqtt",
        {"broker_url": "mqtt://broker:1883", "topics": "alpha, beta, ,gamma"},
        db=db,
        broadcaster=broadcaster,
        session_dir=str(tmp_path),
    )
    assert isinstance(adapter, MqttAdapter)
    assert adapter._topics == ["alpha", "beta", "gamma"]


def test_factory_builds_discord_adapter(db, broadcaster, tmp_path):
    from server.collector.discord import DiscordAdapter

    adapter = build_adapter(
        "a-1",
        "discord",
        {"bot_token": "token-x"},
        db=db,
        broadcaster=broadcaster,
        session_dir=str(tmp_path),
    )
    assert isinstance(adapter, DiscordAdapter)
    assert adapter.state.platform == "discord"


# ── base adapter: ingest + status broadcast ─────────────────────────────────


class _FakeAdapter(BasePlatformAdapter):
    """Deterministic adapter for exercising BasePlatformAdapter behavior."""

    def __init__(self, account_id: str, db: Database, broadcaster: SseBroadcaster, fail_times: int = 0) -> None:
        super().__init__(account_id, db, broadcaster)
        self.connect_attempts = 0
        self._fail_times = fail_times

    def _platform_name(self) -> str:
        return "http"

    async def connect(self) -> None:
        self.connect_attempts += 1
        if self.connect_attempts <= self._fail_times:
            raise ConnectionError(f"attempt {self.connect_attempts} failed")

    async def disconnect(self) -> None:
        self._state.status = "disconnected"

    async def is_connected(self) -> bool:
        return self._state.status == "connected"


async def test_base_insert_message_publishes_and_dedups(db, broadcaster):
    await insert_minimal_account(db, "a-1", "http")
    adapter = _FakeAdapter("a-1", db, broadcaster)
    queue = broadcaster.subscribe()
    try:
        kwargs = dict(
            platform="rss",
            platform_id="feed-1",
            content="entry body",
            message_time="2026-01-01T00:00:00+00:00",
            platform_message_id="entry-1",
            channel_name="Feed",
        )
        await adapter._insert_message(**kwargs)
        await adapter._insert_message(**kwargs)  # duplicate — no second event
    finally:
        broadcaster.unsubscribe(queue)

    events = _drain_events(queue)
    assert len(events) == 1
    assert events[0]["event"] == "messages_updated"
    assert events[0]["payload"]["messages"][0]["content"] == "entry body"
    count = await db.fetch_value("SELECT COUNT(*) FROM messages")
    assert count == 1


async def test_reconnect_loop_recovers_after_failures(db, broadcaster):
    await insert_minimal_account(db, "a-1", "http")
    adapter = _FakeAdapter("a-1", db, broadcaster, fail_times=2)
    queue = broadcaster.subscribe()
    try:
        reconnected = await adapter._reconnect_loop(base_delay=0.001, max_delay=0.004)
    finally:
        broadcaster.unsubscribe(queue)

    assert reconnected is True
    assert adapter.connect_attempts == 3
    assert adapter.state.status == "connected"
    assert adapter.state.last_error is None

    events = _drain_events(queue)
    statuses = [e["payload"]["status"] for e in events if e["event"] == "account_status_changed"]
    assert statuses[0] == "connecting"
    assert statuses[-1] == "connected"

    persisted = await db.fetch_value("SELECT status FROM accounts WHERE id = 'a-1'")
    assert persisted == "connected"


async def test_reconnect_loop_stops_when_account_disabled(db, broadcaster):
    await insert_minimal_account(db, "a-1", "http", status="disconnected")
    adapter = _FakeAdapter("a-1", db, broadcaster, fail_times=99)

    reconnected = await adapter._reconnect_loop(base_delay=0.001, max_delay=0.004)

    assert reconnected is False
    assert adapter.connect_attempts == 0
    assert adapter.state.status == "disconnected"


async def test_reconnect_loop_stops_when_account_deleted(db, broadcaster):
    adapter = _FakeAdapter("missing-account", db, broadcaster, fail_times=99)
    reconnected = await adapter._reconnect_loop(base_delay=0.001, max_delay=0.004)
    assert reconnected is False


# ── RSS adapter smoke: connect → ingest → disconnect (mocked HTTP) ──────────

_RSS_XML_ONE_ENTRY = """<?xml version="1.0"?>
<rss version="2.0"><channel><title>Smoke Feed</title>
<item><title>First</title><link>https://example.com/1</link><guid>entry-1</guid>
<description>first body</description></item>
</channel></rss>"""

_RSS_XML_TWO_ENTRIES = """<?xml version="1.0"?>
<rss version="2.0"><channel><title>Smoke Feed</title>
<item><title>First</title><link>https://example.com/1</link><guid>entry-1</guid>
<description>first body</description></item>
<item><title>Second</title><link>https://example.com/2</link><guid>entry-2</guid>
<description>second body</description></item>
</channel></rss>"""


def test_rss_entry_time_treats_feedparser_tuple_as_utc():
    entry = SimpleNamespace(published_parsed=(2026, 1, 2, 3, 4, 5, 4, 2, -1))
    assert RssAdapter._get_entry_time(entry) == "2026-01-02T03:04:05Z"


class _FakeHttpResponse:
    def __init__(self, text: str) -> None:
        self._text = text

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    def raise_for_status(self) -> None:
        pass

    async def text(self) -> str:
        return self._text


class _FakeHttpSession:
    """Returns the first payload once, then the second forever after."""

    def __init__(self, payloads: list[str]) -> None:
        self._payloads = payloads
        self.closed = False

    def get(self, url: str, **_kwargs) -> _FakeHttpResponse:
        text = self._payloads[0] if len(self._payloads) == 1 else self._payloads.pop(0)
        return _FakeHttpResponse(text)

    async def close(self) -> None:
        self.closed = True


async def test_rss_adapter_connect_ingest_disconnect(db, broadcaster, monkeypatch):
    await insert_minimal_account(db, "a-rss", "rss")
    fake_session = _FakeHttpSession([_RSS_XML_ONE_ENTRY, _RSS_XML_TWO_ENTRIES])
    session_options = {}

    async def allow_url(*_args, **_kwargs):
        return None

    def create_session(**kwargs):
        session_options.update(kwargs)
        return fake_session

    monkeypatch.setattr("server.collector.rss.aiohttp.ClientSession", create_session)
    monkeypatch.setattr("server.collector.rss.validate_outbound_url", allow_url)

    adapter = RssAdapter("a-rss", db, broadcaster, "https://example.com/feed.xml", poll_interval=0.01)
    queue = broadcaster.subscribe()
    try:
        await adapter.connect()
        assert await adapter.is_connected()
        assert adapter.state.status == "connected"
        setattr(adapter, "_poll_interval", 0.01)

        # The connect-time entry is marked seen; only "entry-2" from the next
        # poll cycle is ingested.
        for _ in range(200):
            if await db.fetch_value("SELECT COUNT(*) FROM messages") == 1:
                break
            await asyncio.sleep(0.01)

        row = await db.fetch_one("SELECT * FROM messages")
        assert row is not None
        assert row["platform"] == "rss"
        assert row["platform_message_id"] == "entry-2"
        assert "Second" in row["content"]
    finally:
        await adapter.disconnect()
        broadcaster.unsubscribe(queue)

    assert not await adapter.is_connected()
    assert adapter.state.status == "disconnected"
    assert fake_session.closed
    assert session_options["timeout"].total == 30

    events = _drain_events(queue)
    assert any(e["event"] == "messages_updated" for e in events)


# ── MQTT adapter smoke: connect → ingest → disconnect (mocked client) ───────


class _FakeMqttMessage:
    def __init__(self, topic: str, payload: bytes) -> None:
        self.topic = topic
        self.payload = payload


class _FakeMqttClient:
    def __init__(self, messages: list[_FakeMqttMessage]) -> None:
        self._queued = messages
        self.subscribed: list[str] = []
        self.exited = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        self.exited = True
        return False

    async def subscribe(self, topic: str) -> None:
        self.subscribed.append(topic)

    @property
    def messages(self):
        async def _iterator():
            for message in self._queued:
                yield message
            await asyncio.Event().wait()  # stay "connected" until cancelled

        return _iterator()


async def test_mqtt_adapter_connect_ingest_disconnect(db, broadcaster, monkeypatch):
    await insert_minimal_account(db, "a-mqtt", "mqtt")
    fake_client = _FakeMqttClient([_FakeMqttMessage("news/alpha", b"mqtt payload")])

    async def allow_host(*_args, **_kwargs):
        return None

    monkeypatch.setattr("server.collector.mqtt.aiomqtt.Client", lambda **kwargs: fake_client)
    monkeypatch.setattr("server.collector.mqtt.validate_outbound_host", allow_host)

    adapter = MqttAdapter("a-mqtt", db, broadcaster, "mqtt://broker:1883", ["news/#"])
    try:
        await adapter.connect()
        assert await adapter.is_connected()
        assert fake_client.subscribed == ["news/#"]

        for _ in range(200):
            if await db.fetch_value("SELECT COUNT(*) FROM messages") == 1:
                break
            await asyncio.sleep(0.01)

        row = await db.fetch_one("SELECT * FROM messages")
        assert row is not None
        assert row["platform"] == "mqtt"
        assert row["content"] == "mqtt payload"
        assert row["sender_name"] == "news/alpha"
    finally:
        await adapter.disconnect()

    assert not await adapter.is_connected()
    assert fake_client.exited


# ── Discord adapter smoke: connect failure path (mocked session) ────────────


class _FailingWsSession:
    def __init__(self) -> None:
        self.closed = False

    async def ws_connect(self, url: str):
        raise OSError("gateway unreachable")

    async def close(self) -> None:
        self.closed = True


async def test_discord_adapter_connect_failure_sets_error_state(db, broadcaster, monkeypatch):
    from server.collector.discord import DiscordAdapter

    await insert_minimal_account(db, "a-dc", "discord")
    failing_session = _FailingWsSession()
    monkeypatch.setattr("server.collector.discord.aiohttp.ClientSession", lambda: failing_session)

    adapter = DiscordAdapter("a-dc", db, broadcaster, "token-x")
    with pytest.raises(OSError):
        await adapter.connect()

    assert adapter.state.status == "error"
    assert adapter.state.last_error == "gateway unreachable"
    assert failing_session.closed
    assert not await adapter.is_connected()


# ── Discord adapter smoke: connect success path (mocked gateway) ────────────


class _FakeDiscordWs:
    def __init__(self) -> None:
        self.closed = False

    async def receive_json(self) -> dict:
        return {"op": 10, "d": {"heartbeat_interval": 60_000}}

    async def send_json(self, data: dict) -> None:
        pass

    async def close(self) -> None:
        self.closed = True

    def __aiter__(self):
        return self

    async def __anext__(self):
        await asyncio.Event().wait()


class _HappyDiscordSession:
    def __init__(self) -> None:
        self.closed = False
        self._ws = _FakeDiscordWs()

    async def ws_connect(self, url: str) -> _FakeDiscordWs:
        return self._ws

    async def close(self) -> None:
        self.closed = True
        self._ws.closed = True


async def test_discord_adapter_connect_success(db, broadcaster, monkeypatch):
    from server.collector.discord import DiscordAdapter

    await insert_minimal_account(db, "a-dc", "discord")
    happy_session = _HappyDiscordSession()
    monkeypatch.setattr("server.collector.discord.aiohttp.ClientSession", lambda: happy_session)

    adapter = DiscordAdapter("a-dc", db, broadcaster, "token-x")
    try:
        await adapter.connect()
        assert adapter.state.status == "connected"
        assert adapter.state.last_error is None
        assert await adapter.is_connected()
    finally:
        await adapter.disconnect()

    assert adapter.state.status == "disconnected"
    assert happy_session.closed


# ── CollectorManager: database-lock retry on auto-connect ───────────────────


class _LockThenConnectAdapter(BasePlatformAdapter):
    def __init__(self, account_id: str, db: Database, broadcaster: SseBroadcaster) -> None:
        super().__init__(account_id, db, broadcaster)
        self.attempts = 0

    def _platform_name(self) -> str:
        return "fake"

    async def connect(self) -> None:
        self.attempts += 1
        if self.attempts < 3:
            raise RuntimeError("database is locked")
        self._mark_connected()

    async def disconnect(self) -> None:
        self._state.status = "disconnected"

    async def is_connected(self) -> bool:
        return self._state.status == "connected"


async def test_manager_retries_auto_connect_on_database_lock(db, broadcaster, monkeypatch):
    from server.collector.manager import CollectorManager

    adapter = _LockThenConnectAdapter("a-lock", db, broadcaster)
    monkeypatch.setattr(
        "server.collector.manager_retry.build_adapter",
        lambda *args, **kwargs: adapter,
    )

    manager = CollectorManager(db, broadcaster)
    accounts = [
        {"id": "a-lock", "name": "test", "platform": "telegram", "credentials": {}},
    ]

    await manager._retry_orchestrator.auto_connect(accounts)  # noqa: SLF001 — owner integration

    assert adapter.attempts == 3
    assert "a-lock" in manager._adapters
    assert manager._adapters["a-lock"].state.status == "connected"


class _UnauthorizedConnectAdapter(BasePlatformAdapter):
    def _platform_name(self) -> str:
        return "telegram"

    async def connect(self) -> None:
        raise RuntimeError("Telegram session is not authorized; complete the interactive login flow first")

    async def disconnect(self) -> None:
        self._state.status = "disconnected"

    async def is_connected(self) -> bool:
        return False


async def test_auto_connect_persists_error_when_session_unauthorized(db, broadcaster, monkeypatch):
    """Sticky DB `connected` must flip to `error` so the Sources UI stops lying."""
    from server.collector.manager import CollectorManager
    from server.tests.db_helpers import insert_minimal_account

    account_id = "tg-unauth"
    await insert_minimal_account(
        db,
        account_id,
        "telegram",
        name="+100",
        status="connected",
    )

    adapter = _UnauthorizedConnectAdapter(account_id, db, broadcaster)
    monkeypatch.setattr(
        "server.collector.manager_retry.build_adapter",
        lambda *args, **kwargs: adapter,
    )

    manager = CollectorManager(db, broadcaster)
    await manager._retry_orchestrator.auto_connect(  # noqa: SLF001
        [{"id": account_id, "name": "+100", "platform": "telegram", "credentials": {}}],
    )

    row = await db.fetch_one("SELECT status, last_error FROM accounts WHERE id = ?", (account_id,))
    assert row is not None
    assert row["status"] == "error"
    assert "not authorized" in str(row["last_error"])
    assert adapter.state.status == "error"

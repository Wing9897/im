"""CollectorManager aggregate status: partial failures and shutdown guards."""

from __future__ import annotations

import asyncio
import inspect
import json

import pytest
from fastapi import FastAPI

from server.collector import manager_sources
from server.collector.base import BasePlatformAdapter
from server.collector.manager import CollectorManager
from server.db.database import Database
from server.sse import SseBroadcaster


class _StubAdapter(BasePlatformAdapter):
    def __init__(
        self,
        account_id: str,
        platform: str,
        db: Database,
        broadcaster: SseBroadcaster,
        *,
        status: str,
        connect_error: Exception | None = None,
        disconnect_error: Exception | None = None,
    ) -> None:
        self._stub_platform = platform
        self._connect_error = connect_error
        self._disconnect_error = disconnect_error
        self.disconnect_calls = 0
        super().__init__(account_id, db, broadcaster)
        self._state.status = status

    def _platform_name(self) -> str:
        return self._stub_platform

    async def connect(self) -> None:
        if self._connect_error is not None:
            raise self._connect_error
        self._state.status = "connected"

    async def disconnect(self) -> None:
        self.disconnect_calls += 1
        if self._disconnect_error is not None:
            raise self._disconnect_error
        self._state.status = "disconnected"

    async def is_connected(self) -> bool:
        return self._state.status == "connected"


async def test_get_status_running_when_one_adapter_connected_one_error(app: FastAPI):
    db = app.state.db
    broadcaster = app.state.broadcaster
    manager = CollectorManager(db, broadcaster)
    manager._adapters = {
        "ok": _StubAdapter("ok", "discord", db, broadcaster, status="connected"),
        "bad": _StubAdapter("bad", "rss", db, broadcaster, status="error"),
    }

    assert await manager.get_status() == "running"


async def test_get_status_error_when_all_adapters_failed(app: FastAPI):
    db = app.state.db
    broadcaster = app.state.broadcaster
    manager = CollectorManager(db, broadcaster)
    manager._adapters = {
        "a": _StubAdapter("a", "rss", db, broadcaster, status="error"),
        "b": _StubAdapter("b", "rss", db, broadcaster, status="error"),
    }

    assert await manager.get_status() == "error"


async def test_publish_aggregate_skipped_during_shutdown(app: FastAPI):
    broadcaster = app.state.broadcaster
    queue = broadcaster.subscribe()
    manager = CollectorManager(app.state.db, broadcaster)
    manager._retry_orchestrator._shutting_down = True  # noqa: SLF001 — shutdown guard fixture
    try:
        await manager._publish_aggregate_collector_status(
            adapter_name="rss",
            error_summary="Connection timeout to host https://hnrss.org/newest",
        )
        with pytest.raises(asyncio.QueueEmpty):
            queue.get_nowait()
    finally:
        broadcaster.unsubscribe(queue)


async def test_publish_aggregate_partial_failure_status_running(app: FastAPI):
    broadcaster = app.state.broadcaster
    queue = broadcaster.subscribe()
    manager = CollectorManager(app.state.db, broadcaster)
    manager._adapters = {
        "ok": _StubAdapter("ok", "discord", app.state.db, broadcaster, status="connected"),
        "bad": _StubAdapter("bad", "rss", app.state.db, broadcaster, status="error"),
    }
    try:
        await manager._publish_aggregate_collector_status(
            adapter_name="rss",
            error_summary="Connection timeout to host https://hnrss.org/newest",
        )
        event = queue.get_nowait()
    finally:
        broadcaster.unsubscribe(queue)

    payload = json.loads(event["data"])["payload"]
    assert payload["status"] == "running"
    assert payload["adapter_name"] == "rss"


async def test_public_facade_delegates_representative_platform_calls(app: FastAPI, monkeypatch):
    manager = CollectorManager(app.state.db, app.state.broadcaster)
    calls: list[tuple[str, tuple, dict]] = []

    def delegate(name: str):
        async def _delegate(*args, **kwargs):
            calls.append((name, args, kwargs))
            return {"platform": name}

        return _delegate

    monkeypatch.setattr("server.collector.manager.telegram_login.start_telegram_login", delegate("telegram"))
    monkeypatch.setattr("server.collector.manager_sources.create_discord_bot", delegate("discord"))
    monkeypatch.setattr("server.collector.manager_sources.create_rss_feed", delegate("rss"))
    monkeypatch.setattr("server.collector.manager_sources.create_mqtt_broker", delegate("mqtt"))
    monkeypatch.setattr("server.collector.manager_sources.create_email_mailbox", delegate("email"))

    assert await manager.start_telegram_login("t", 1, "hash", "+100") == {"platform": "telegram"}
    assert await manager_sources.create_discord_bot(manager, "d", "token") == {"platform": "discord"}
    assert await manager_sources.create_rss_feed(manager, "r", "https://example.test/feed", 60) == {"platform": "rss"}
    assert await manager_sources.create_mqtt_broker(manager, "m", "mqtt://host", ["topic"], username="u") == {
        "platform": "mqtt"
    }
    assert await manager_sources.create_email_mailbox(manager, "e", {"host": "mail.example.test"}) == {
        "platform": "email"
    }

    assert [name for name, _args, _kwargs in calls] == ["telegram", "discord", "rss", "mqtt", "email"]
    assert all(args[0] is manager for _name, args, _kwargs in calls)
    assert calls[3][2] == {"username": "u"}


def test_public_facade_signatures_remain_compatible() -> None:
    expected_parameters = {
        "start": ("self",),
        "shutdown": ("self",),
        "restart": ("self",),
        "start_telegram_login": ("self", "account_id", "api_id", "api_hash", "phone"),
        "start_telegram_qr_login": ("self", "account_id", "api_id", "api_hash"),
        "wait_telegram_qr_login": ("self", "account_id", "timeout"),
        "verify_telegram_code": ("self", "account_id", "code", "phone_code_hash"),
        "verify_telegram_2fa": ("self", "account_id", "password", "phone_code_hash"),
    }
    for method_name, expected in expected_parameters.items():
        parameters = inspect.signature(getattr(CollectorManager, method_name)).parameters
        assert tuple(parameters) == expected

    assert inspect.signature(CollectorManager.verify_telegram_2fa).parameters["phone_code_hash"].default is None

    # Platform create/update/subscribe live on manager_sources (no thin CollectorManager wrappers).
    source_expected = {
        "create_discord_bot": ("host", "account_id", "bot_token"),
        "create_rss_feed": ("host", "account_id", "feed_url", "poll_interval_seconds"),
        "create_mqtt_broker": (
            "host",
            "account_id",
            "broker_url",
            "topics",
            "username",
            "password",
            "client_id",
        ),
        "create_email_mailbox": ("host", "account_id", "credentials"),
    }
    for method_name, expected in source_expected.items():
        parameters = inspect.signature(getattr(manager_sources, method_name)).parameters
        assert tuple(parameters) == expected

    assert inspect.signature(manager_sources.create_rss_feed).parameters["poll_interval_seconds"].default == 300
    for name in ("username", "password", "client_id"):
        assert inspect.signature(manager_sources.create_mqtt_broker).parameters[name].default is None


async def test_stop_adapter_keeps_registry_entry_when_disconnect_fails(app: FastAPI) -> None:
    manager = CollectorManager(app.state.db, app.state.broadcaster)
    adapter = _StubAdapter(
        "broken",
        "rss",
        app.state.db,
        app.state.broadcaster,
        status="connected",
        disconnect_error=RuntimeError("teardown failed"),
    )
    manager._adapters["broken"] = adapter

    with pytest.raises(RuntimeError, match="teardown failed"):
        await manager.stop_adapter("broken")

    assert manager._adapters["broken"] is adapter


async def test_build_and_connect_compensates_failed_new_adapter(app: FastAPI, monkeypatch) -> None:
    manager = CollectorManager(app.state.db, app.state.broadcaster)
    adapter = _StubAdapter(
        "new",
        "rss",
        app.state.db,
        app.state.broadcaster,
        status="disconnected",
        connect_error=RuntimeError("connect failed"),
    )
    monkeypatch.setattr("server.collector.manager.build_adapter", lambda *args, **kwargs: adapter)

    with pytest.raises(RuntimeError, match="connect failed"):
        await manager._build_and_connect("new", "rss", {})

    assert adapter.disconnect_calls == 1
    assert "new" not in manager._adapters

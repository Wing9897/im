"""Telegram dialog sync — iter_dialogs populates channels + account_channels."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from server.collector.telegram import TelegramAdapter
from server.db.database import Database
from server.sse import SseBroadcaster


class _FakeDialog:
    def __init__(self, dialog_id: int, name: str, entity: object) -> None:
        self.id = dialog_id
        self.name = name
        self.entity = entity


async def _fake_iter_dialogs():
    from datetime import datetime, timezone

    from telethon.tl.types import Channel as TgChannel
    from telethon.tl.types import Chat, ChatPhotoEmpty

    now = datetime.now(timezone.utc)
    photo = ChatPhotoEmpty()
    yield _FakeDialog(
        -1001,
        "Alpha Group",
        Chat(id=1001, title="Alpha Group", photo=photo, participants_count=0, date=now, version=0),
    )
    yield _FakeDialog(
        -1002,
        "Beta Channel",
        TgChannel(id=1002, title="Beta Channel", photo=photo, date=now),
    )
    yield _FakeDialog(999, "Private DM", SimpleNamespace())  # skipped


@pytest.mark.asyncio
async def test_sync_dialog_channels_persists_groups_and_links(tmp_path) -> None:
    db = Database(str(tmp_path / "tg-sync.db"))
    await db.connect()
    await db.ensure_schema()

    account_id = "acc-telegram-1"
    await db.execute(
        "INSERT INTO accounts (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES (?, 'telegram', '+123', 'connected', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        (account_id,),
    )

    adapter = TelegramAdapter(
        account_id,
        db,
        SseBroadcaster(),
        api_id=1,
        api_hash="hash",
        session_dir=str(tmp_path / "sessions"),
    )
    client = MagicMock()
    client.is_user_authorized = AsyncMock(return_value=True)
    client.iter_dialogs = _fake_iter_dialogs
    adapter._client = client

    synced = await adapter.sync_dialog_channels()
    assert synced == 2

    channels = await db.fetch_all(
        "SELECT platform_id, channel_name FROM channels WHERE platform = 'telegram' ORDER BY platform_id"
    )
    assert len(channels) == 2
    assert channels[0]["channel_name"] == "Alpha Group"
    assert channels[1]["channel_name"] == "Beta Channel"

    links = await db.fetch_all(
        "SELECT platform_id FROM account_channels WHERE account_id = ? AND platform = 'telegram'",
        (account_id,),
    )
    assert len(links) == 2

    await db.close()


@pytest.mark.asyncio
async def test_no_subscriptions_does_not_register_catch_all_handler(tmp_path) -> None:
    db = Database(str(tmp_path / "tg-empty-subscriptions.db"))
    await db.connect()
    await db.ensure_schema()
    adapter = TelegramAdapter(
        "acc-without-channels",
        db,
        SseBroadcaster(),
        api_id=1,
        api_hash="hash",
        session_dir=str(tmp_path / "sessions"),
    )
    client = MagicMock()
    adapter._client = client

    await adapter._register_message_handlers()

    client.add_event_handler.assert_not_called()
    await db.close()


@pytest.mark.asyncio
async def test_register_message_handlers_clears_before_reregister(tmp_path) -> None:
    db = Database(str(tmp_path / "tg-handler-reregister.db"))
    await db.connect()
    await db.ensure_schema()

    account_id = "acc-telegram-handlers"
    await db.execute(
        "INSERT INTO accounts (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES (?, 'telegram', '+123', 'connected', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        (account_id,),
    )
    await db.execute(
        "INSERT INTO channels (platform, platform_id, channel_name, created_at) "
        "VALUES ('telegram', '-1001', 'Alpha', '2026-01-01T00:00:00Z')",
    )
    await db.execute(
        "INSERT INTO account_channels (account_id, platform, platform_id) VALUES (?, 'telegram', '-1001')",
        (account_id,),
    )

    adapter = TelegramAdapter(
        account_id,
        db,
        SseBroadcaster(),
        api_id=1,
        api_hash="hash",
        session_dir=str(tmp_path / "sessions"),
    )
    client = MagicMock()
    adapter._client = client

    await adapter._register_message_handlers()
    await adapter._register_message_handlers()

    assert client.remove_event_handler.call_count == 1
    assert client.add_event_handler.call_count == 2
    await db.close()


@pytest.mark.asyncio
async def test_disconnect_clears_message_handlers(tmp_path) -> None:
    db = Database(str(tmp_path / "tg-handler-disconnect.db"))
    await db.connect()
    await db.ensure_schema()

    account_id = "acc-telegram-disconnect"
    await db.execute(
        "INSERT INTO accounts (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES (?, 'telegram', '+123', 'connected', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        (account_id,),
    )
    await db.execute(
        "INSERT INTO channels (platform, platform_id, channel_name, created_at) "
        "VALUES ('telegram', '-1002', 'Beta', '2026-01-01T00:00:00Z')",
    )
    await db.execute(
        "INSERT INTO account_channels (account_id, platform, platform_id) VALUES (?, 'telegram', '-1002')",
        (account_id,),
    )

    adapter = TelegramAdapter(
        account_id,
        db,
        SseBroadcaster(),
        api_id=1,
        api_hash="hash",
        session_dir=str(tmp_path / "sessions"),
    )
    client = MagicMock()
    client.disconnect = MagicMock(return_value=None)
    adapter._client = client

    await adapter._register_message_handlers()
    await adapter.disconnect()

    client.remove_event_handler.assert_called_once()
    await db.close()


@pytest.mark.asyncio
async def test_connect_rejects_revoked_or_unauthorized_session(tmp_path, monkeypatch) -> None:
    db = Database(str(tmp_path / "tg-unauthorized.db"))
    await db.connect()
    await db.ensure_schema()
    adapter = TelegramAdapter(
        "acc-telegram-unauthorized",
        db,
        SseBroadcaster(),
        api_id=1,
        api_hash="hash",
        session_dir=str(tmp_path / "sessions"),
    )
    client = MagicMock()
    client.connect = AsyncMock()
    client.is_user_authorized = AsyncMock(return_value=False)
    client.disconnect = MagicMock(return_value=None)
    monkeypatch.setattr("server.collector.telegram.TelegramClient", lambda *args, **kwargs: client)

    with pytest.raises(RuntimeError, match="not authorized"):
        await adapter.connect()

    assert adapter.state.status == "disconnected"
    assert adapter._client is None
    client.disconnect.assert_called_once()
    await db.close()


@pytest.mark.asyncio
async def test_connect_succeeds_when_background_dialog_sync_is_locked(tmp_path, monkeypatch) -> None:
    db = Database(str(tmp_path / "tg-connect.db"))
    await db.connect()
    await db.ensure_schema()

    account_id = "acc-telegram-connect"
    await db.execute(
        "INSERT INTO accounts (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES (?, 'telegram', '+123', 'connected', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        (account_id,),
    )

    adapter = TelegramAdapter(
        account_id,
        db,
        SseBroadcaster(),
        api_id=1,
        api_hash="hash",
        session_dir=str(tmp_path / "sessions"),
    )

    client = MagicMock()
    client.is_user_authorized = AsyncMock(return_value=True)
    client.connect = AsyncMock()
    client.disconnect = MagicMock(return_value=None)

    monkeypatch.setattr(
        "server.collector.telegram.TelegramClient",
        lambda *args, **kwargs: client,
    )

    await adapter.connect()
    assert adapter.state.status == "connected"

    assert adapter._startup_task is not None
    await adapter._startup_task

    await adapter.disconnect()
    await db.close()

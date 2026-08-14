"""Telegram dialog sync — iter_dialogs populates channels + source_channels."""

from __future__ import annotations

from datetime import UTC
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from server.collector.telegram import TelegramAdapter
from server.db.database import Database
from server.sse import SseBroadcaster
from server.tests.db_helpers import insert_channel, insert_minimal_source, link_source_channel


async def _tg_source(
    db: Database,
    source_id: str,
    *,
    channel_id: str | None = None,
    channel_name: str = "Alpha",
) -> None:
    await insert_minimal_source(db, source_id, "telegram", name="+123", credentials="{}")
    if channel_id is None:
        return
    await insert_channel(db, "telegram", channel_id, channel_name=channel_name)
    await link_source_channel(db, source_id, "telegram", channel_id)


class _FakeDialog:
    def __init__(self, dialog_id: int, name: str, entity: object) -> None:
        self.id = dialog_id
        self.name = name
        self.entity = entity


async def _fake_iter_dialogs():
    from datetime import datetime

    from telethon.tl.types import Channel as TgChannel
    from telethon.tl.types import Chat, ChatPhotoEmpty

    now = datetime.now(UTC)
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

    source_id = "acc-telegram-1"
    await _tg_source(db, source_id)

    adapter = TelegramAdapter(
        source_id,
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
        "SELECT platform_id FROM source_channels WHERE source_id = ? AND platform = 'telegram'",
        (source_id,),
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

    source_id = "acc-telegram-handlers"
    await _tg_source(db, source_id, channel_id="-1001", channel_name="Alpha")

    adapter = TelegramAdapter(
        source_id,
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

    source_id = "acc-telegram-disconnect"
    await _tg_source(db, source_id, channel_id="-1002", channel_name="Beta")

    adapter = TelegramAdapter(
        source_id,
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

    source_id = "acc-telegram-connect"
    await _tg_source(db, source_id)

    adapter = TelegramAdapter(
        source_id,
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

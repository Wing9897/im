"""Unit tests for server/ingestion.py: channel upsert semantics + dedup insert."""

from __future__ import annotations

from typing import Any, AsyncIterator

import pytest

from server.db.database import Database
from server.ingestion import insert_message, upsert_channel


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "ingestion-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


async def _channel_name(db: Database, platform: str, platform_id: str) -> str | None:
    return await db.fetch_value(
        "SELECT channel_name FROM channels WHERE platform = ? AND platform_id = ?",
        (platform, platform_id),
    )


# ── upsert_channel ──────────────────────────────────────────────────────────


async def test_upsert_channel_creates_row(db: Database):
    await upsert_channel(db, "rss", "feed-1", "My Feed")
    assert await _channel_name(db, "rss", "feed-1") == "My Feed"


async def test_upsert_channel_blank_name_preserved(db: Database):
    await upsert_channel(db, "rss", "feed-1")
    assert await _channel_name(db, "rss", "feed-1") == ""


async def test_upsert_channel_backfills_blank_name(db: Database):
    await upsert_channel(db, "rss", "feed-1")
    await upsert_channel(db, "rss", "feed-1", "Late Name")
    assert await _channel_name(db, "rss", "feed-1") == "Late Name"


async def test_upsert_channel_does_not_overwrite_existing_name(db: Database):
    await upsert_channel(db, "rss", "feed-1", "Original")
    await upsert_channel(db, "rss", "feed-1", "Replacement")
    assert await _channel_name(db, "rss", "feed-1") == "Original"


async def test_upsert_channel_refresh_name_overwrites(db: Database):
    await upsert_channel(db, "discord", "chan-1", "Old Name")
    await upsert_channel(db, "discord", "chan-1", "New Name", refresh_name=True)
    assert await _channel_name(db, "discord", "chan-1") == "New Name"


async def test_upsert_channel_is_idempotent(db: Database):
    for _ in range(3):
        await upsert_channel(db, "mqtt", "broker-1", "Broker")
    rows = await db.fetch_all("SELECT * FROM channels WHERE platform = 'mqtt' AND platform_id = 'broker-1'")
    assert len(rows) == 1


# ── insert_message ──────────────────────────────────────────────────────────


async def test_insert_message_returns_camel_case_shape(db: Database):
    message = await insert_message(
        db,
        message_id="msg-1",
        source_id=None,
        platform="rss",
        platform_id="feed-1",
        content="hello",
        timestamp="2026-01-01T00:00:00+00:00",
        sender_id="s-1",
        sender_name="Sender",
        platform_message_id="entry-1",
        channel_name="My Feed",
    )
    assert message is not None
    assert message["id"] == "msg-1"
    assert message["sourceId"] is None
    assert message["platform"] == "rss"
    assert message["platformId"] == "feed-1"
    assert message["channelName"] == "My Feed"
    assert message["platformMessageId"] == "entry-1"
    assert message["senderId"] == "s-1"
    assert message["senderName"] == "Sender"
    assert message["content"] == "hello"
    assert message["timestamp"] == "2026-01-01T00:00:00+00:00"
    assert message["createdAt"]


async def test_insert_message_persists_row(db: Database):
    await insert_message(
        db,
        message_id="msg-1",
        source_id=None,
        platform="rss",
        platform_id="feed-1",
        content="hello",
        timestamp="2026-01-01T00:00:00+00:00",
        platform_message_id="entry-1",
    )
    row = await db.fetch_one("SELECT * FROM messages WHERE id = 'msg-1'")
    assert row is not None
    assert row["platform_message_id"] == "entry-1"


async def test_insert_message_dedup_returns_none(db: Database):
    kwargs: dict[str, Any] = dict(
        source_id=None,
        platform="rss",
        platform_id="feed-1",
        content="hello",
        timestamp="2026-01-01T00:00:00+00:00",
        platform_message_id="entry-1",
    )
    first = await insert_message(db, message_id="msg-1", **kwargs)
    duplicate = await insert_message(db, message_id="msg-2", **kwargs)
    assert first is not None
    assert duplicate is None
    count = await db.fetch_value("SELECT COUNT(*) FROM messages")
    assert count == 1


async def test_insert_message_null_platform_message_ids_are_distinct(db: Database):
    """SQLite unique index treats NULLs as distinct; both rows must insert."""
    kwargs: dict[str, Any] = dict(
        source_id=None,
        platform="mqtt",
        platform_id="broker-1",
        content="payload",
        timestamp="2026-01-01T00:00:00+00:00",
        platform_message_id=None,
    )
    assert await insert_message(db, message_id="msg-1", **kwargs) is not None
    assert await insert_message(db, message_id="msg-2", **kwargs) is not None
    count = await db.fetch_value("SELECT COUNT(*) FROM messages")
    assert count == 2


async def test_insert_message_channel_name_falls_back_to_stored(db: Database):
    """API-ingested messages (blank channel_name) carry the stored channel name."""
    await upsert_channel(db, "rss", "feed-1", "Known Feed")
    message = await insert_message(
        db,
        message_id="msg-1",
        source_id=None,
        platform="rss",
        platform_id="feed-1",
        content="hello",
        timestamp="2026-01-01T00:00:00+00:00",
        platform_message_id="entry-1",
        channel_name="",
    )
    assert message is not None
    assert message["channelName"] == "Known Feed"


async def test_insert_message_unknown_channel_name_is_none(db: Database):
    message = await insert_message(
        db,
        message_id="msg-1",
        source_id=None,
        platform="rss",
        platform_id="brand-new-feed",
        content="hello",
        timestamp="2026-01-01T00:00:00+00:00",
        platform_message_id="entry-1",
    )
    assert message is not None
    assert message["channelName"] is None

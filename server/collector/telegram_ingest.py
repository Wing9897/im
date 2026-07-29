"""Telegram dialog synchronization and incoming-message normalization."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from telethon.tl.types import Channel as TgChannel
from telethon.tl.types import Chat

from server.collector.telegram_media import build_telegram_raw_data
from server.db.database import TransactionDb
from server.ingestion import upsert_channel
from server.time_iso import to_iso_z
from server.util import utc_now_iso

logger = logging.getLogger(__name__)


async def sync_dialog_channels(adapter: Any) -> int:
    if adapter._client is None or not await adapter._client.is_user_authorized():
        return 0
    entries: list[tuple[str, str]] = []
    async for dialog in adapter._client.iter_dialogs():
        entity = dialog.entity
        if not isinstance(entity, (TgChannel, Chat)):
            continue
        entries.append((str(dialog.id), dialog.name or ""))
    if not entries:
        return 0
    async with adapter._db.transaction() as conn:
        tx = TransactionDb(conn)
        for platform_id, channel_name in entries:
            await upsert_channel(
                tx,
                "telegram",
                platform_id,
                channel_name,
                refresh_name=bool(channel_name),
            )
            await conn.execute(
                "INSERT OR IGNORE INTO account_channels (account_id, platform, platform_id) VALUES (?, 'telegram', ?)",
                (adapter._account_id, platform_id),
            )
    synced = len(entries)
    logger.info("Synced %d Telegram dialog(s) for account %s", synced, adapter._account_id)
    return synced


async def load_subscribed_channels(adapter: Any) -> list[int]:
    rows = await adapter._db.fetch_all(
        "SELECT platform_id FROM account_channels WHERE account_id = ? AND platform = 'telegram'",
        (adapter._account_id,),
    )
    channel_ids: list[int] = []
    for row in rows:
        try:
            channel_ids.append(int(row["platform_id"]))
        except (ValueError, TypeError):
            logger.warning(
                "Skipping non-integer platform_id %r for account %s",
                row["platform_id"],
                adapter._account_id,
            )
    return channel_ids


async def resolve_channel_name(adapter: Any, event: Any) -> str:
    try:
        chat = await event.get_chat()
        return getattr(chat, "title", None) or getattr(chat, "username", None) or ""
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.warning(
            "Failed to resolve Telegram channel name for account %s: %s",
            adapter._account_id,
            exc,
        )
        return ""


async def handle_message(adapter: Any, event: Any) -> None:
    sender = event.sender
    if sender is not None:
        sender_id = str(getattr(sender, "id", "")) if getattr(sender, "id", None) else None
        sender_name = (
            getattr(sender, "username", None)
            or getattr(sender, "first_name", None)
            or getattr(sender, "title", None)
            or None
        )
    else:
        sender_id = None
        sender_name = None
    platform_id = str(event.chat_id)
    platform_message_id = str(event.message.id)
    content = event.message.message or ""
    channel_name = await adapter._resolve_channel_name(event)
    msg_date = event.message.date
    message_time = to_iso_z(msg_date) if isinstance(msg_date, datetime) else utc_now_iso()
    await adapter._insert_message(
        platform="telegram",
        platform_id=platform_id,
        platform_message_id=platform_message_id,
        content=content,
        sender_id=sender_id or None,
        sender_name=sender_name or None,
        channel_name=channel_name,
        raw_data=build_telegram_raw_data(event.message),
        message_time=message_time,
    )

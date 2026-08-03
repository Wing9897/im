"""Telegram dialog synchronization and incoming-message normalization."""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime
from typing import Any

from telethon.errors import FloodWaitError
from telethon.tl.types import Channel as TgChannel
from telethon.tl.types import Chat

from server.collector.telegram_media import build_telegram_raw_data
from server.db.database import TransactionDb
from server.ingestion import upsert_channel
from server.time_iso import to_iso_z
from server.util import utc_now_iso

logger = logging.getLogger(__name__)

#: Bounded history pull after handler registration (product default).
BACKFILL_LIMIT_PER_DIALOG = 100
#: Short pause between dialogs to reduce FloodWait risk.
BACKFILL_DIALOG_SLEEP_SECONDS = 0.5
#: Abort remaining dialogs when a single FloodWait exceeds this.
FLOOD_WAIT_ABORT_SECONDS = 120


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


def _sender_fields(sender: Any) -> tuple[str | None, str | None]:
    if sender is None:
        return None, None
    sender_id = str(getattr(sender, "id", "")) if getattr(sender, "id", None) else None
    sender_name = (
        getattr(sender, "username", None)
        or getattr(sender, "first_name", None)
        or getattr(sender, "title", None)
        or None
    )
    return sender_id, sender_name


async def ingest_telethon_message(
    adapter: Any,
    *,
    message: Any,
    chat_id: int | str,
    channel_name: str = "",
    sender_id: str | None = None,
    sender_name: str | None = None,
) -> None:
    """Normalize one Telethon message (live event or history) and insert via the adapter."""
    platform_id = str(chat_id)
    platform_message_id = str(getattr(message, "id", "") or "")
    if not platform_message_id:
        return
    content = getattr(message, "message", None) or ""
    msg_date = getattr(message, "date", None)
    message_time = to_iso_z(msg_date) if isinstance(msg_date, datetime) else utc_now_iso()
    await adapter._insert_message(
        platform="telegram",
        platform_id=platform_id,
        platform_message_id=platform_message_id,
        content=content,
        sender_id=sender_id or None,
        sender_name=sender_name or None,
        channel_name=channel_name,
        raw_data=build_telegram_raw_data(message),
        message_time=message_time,
    )


async def handle_message(adapter: Any, event: Any) -> None:
    sender_id, sender_name = _sender_fields(event.sender)
    channel_name = await adapter._resolve_channel_name(event)
    await ingest_telethon_message(
        adapter,
        message=event.message,
        chat_id=event.chat_id,
        channel_name=channel_name,
        sender_id=sender_id,
        sender_name=sender_name,
    )


async def _channel_name_map(adapter: Any) -> dict[int, str]:
    rows = await adapter._db.fetch_all(
        "SELECT ac.platform_id, c.channel_name "
        "FROM account_channels ac "
        "LEFT JOIN channels c ON c.platform = ac.platform AND c.platform_id = ac.platform_id "
        "WHERE ac.account_id = ? AND ac.platform = 'telegram'",
        (adapter._account_id,),
    )
    out: dict[int, str] = {}
    for row in rows:
        try:
            out[int(row["platform_id"])] = str(row["channel_name"] or "")
        except (ValueError, TypeError):
            continue
    return out


async def _backfill_one_dialog(
    adapter: Any,
    *,
    chat_id: int,
    channel_name: str,
    limit: int,
) -> int:
    """Pull up to ``limit`` recent messages for one dialog. Raises FloodWaitError if wait > abort."""
    ingested = 0
    while True:
        try:
            async for message in adapter._client.iter_messages(chat_id, limit=limit):
                if getattr(message, "id", None) is None:
                    continue
                sender = getattr(message, "sender", None)
                if sender is None and hasattr(message, "get_sender"):
                    try:
                        sender = await message.get_sender()
                    except Exception:  # noqa: BLE001 — best-effort only
                        sender = None
                sender_id, sender_name = _sender_fields(sender)
                await ingest_telethon_message(
                    adapter,
                    message=message,
                    chat_id=chat_id,
                    channel_name=channel_name,
                    sender_id=sender_id,
                    sender_name=sender_name,
                )
                ingested += 1
            return ingested
        except FloodWaitError as exc:
            wait = int(getattr(exc, "seconds", 0) or 0)
            if wait > FLOOD_WAIT_ABORT_SECONDS:
                raise
            jitter = random.uniform(0.5, 1.5)
            logger.warning(
                "Telegram FloodWait %ss during backfill for account %s dialog %s; sleeping %.1fs",
                wait,
                adapter._account_id,
                chat_id,
                wait + jitter,
            )
            await asyncio.sleep(wait + jitter)
            # Retry the same dialog after a short FloodWait.


async def backfill_recent_messages(
    adapter: Any,
    *,
    limit_per_dialog: int = BACKFILL_LIMIT_PER_DIALOG,
) -> int:
    """Serial per-dialog history pull (bounded). Safe to re-run (DB dedupes).

    Returns the number of messages attempted for ingest (including duplicates).
    """
    if adapter._client is None or not await adapter._client.is_user_authorized():
        return 0
    channel_ids = await load_subscribed_channels(adapter)
    if not channel_ids:
        return 0
    names = await _channel_name_map(adapter)
    limit = max(1, int(limit_per_dialog))
    total = 0
    for index, chat_id in enumerate(channel_ids):
        try:
            total += await _backfill_one_dialog(
                adapter,
                chat_id=chat_id,
                channel_name=names.get(chat_id, ""),
                limit=limit,
            )
        except FloodWaitError as exc:
            wait = int(getattr(exc, "seconds", 0) or 0)
            logger.warning(
                "Telegram FloodWait %ss exceeds abort threshold (%ss); "
                "stopping remaining backfill for account %s (done %d/%d dialogs)",
                wait,
                FLOOD_WAIT_ABORT_SECONDS,
                adapter._account_id,
                index,
                len(channel_ids),
            )
            break
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — one dialog must not abort the rest
            logger.warning(
                "Telegram backfill failed for account %s dialog %s: %s",
                adapter._account_id,
                chat_id,
                exc,
            )
        if index + 1 < len(channel_ids):
            await asyncio.sleep(BACKFILL_DIALOG_SLEEP_SECONDS)
    logger.info(
        "Telegram history backfill finished for account %s: %d message(s) across %d dialog(s)",
        adapter._account_id,
        total,
        len(channel_ids),
    )
    return total

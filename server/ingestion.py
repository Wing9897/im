"""Shared message ingestion: channel upsert + dedup-aware message insert.

Both the collector adapters (server/collector/base.py) and the external
ingestion API (server/api/routes/messages.py) write messages through this
module so the "channel upsert + insert + dedup" logic and the resulting
camelCase wire shape live in exactly one place.
"""

from __future__ import annotations

from typing import Any, Optional

from server.util import utc_now_iso
from server.wire.serializers import serialize_message


async def upsert_channel(
    db: Any,
    platform: str,
    platform_id: str,
    channel_name: str = "",
    *,
    refresh_name: bool = False,
) -> None:
    """Idempotent channel upsert.

    With a non-empty ``channel_name`` the stored blank name is backfilled;
    with ``refresh_name`` the stored name is overwritten unconditionally
    (used where the platform API is authoritative for names, e.g. Discord).
    """
    await db.execute(
        "INSERT OR IGNORE INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        (platform, platform_id, channel_name, utc_now_iso()),
    )
    if not channel_name:
        return
    if refresh_name:
        await db.execute(
            "UPDATE channels SET channel_name = ? WHERE platform = ? AND platform_id = ?",
            (channel_name, platform, platform_id),
        )
    else:
        await db.execute(
            "UPDATE channels SET channel_name = ? "
            "WHERE platform = ? AND platform_id = ? "
            "AND (channel_name IS NULL OR channel_name = '')",
            (channel_name, platform, platform_id),
        )


async def insert_message(
    db: Any,
    *,
    message_id: str,
    account_id: Optional[str],
    platform: str,
    platform_id: str,
    content: str,
    timestamp: str,
    sender_id: Optional[str] = None,
    sender_name: Optional[str] = None,
    platform_message_id: Optional[str] = None,
    raw_data: Optional[str] = None,
    channel_name: str = "",
) -> Optional[dict[str, Any]]:
    """Upsert the channel, insert the message (dedup via the
    ``(platform, platform_id, platform_message_id)`` unique index), and
    return the camelCase Message dict — or ``None`` for a duplicate.
    """
    created_at = utc_now_iso()
    await upsert_channel(db, platform, platform_id, channel_name)

    inserted = await db.execute(
        "INSERT OR IGNORE INTO messages "
        "(id, account_id, platform, platform_id, platform_message_id, "
        " sender_id, sender_name, content, timestamp, raw_data, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            message_id,
            account_id,
            platform,
            platform_id,
            platform_message_id,
            sender_id,
            sender_name,
            content,
            timestamp,
            raw_data,
            created_at,
        ),
    )
    if inserted == 0:
        return None

    # Prefer the caller-supplied channel name; fall back to the stored one so
    # API-ingested messages (blank name) still carry the known channel name.
    effective_name: Optional[str] = channel_name or None
    if effective_name is None:
        effective_name = (
            await db.fetch_value(
                "SELECT channel_name FROM channels WHERE platform = ? AND platform_id = ?",
                (platform, platform_id),
            )
            or None
        )

    return serialize_message(
        {
            "id": message_id,
            "account_id": account_id,
            "platform": platform,
            "platform_id": platform_id,
            "channel_name": effective_name,
            "platform_message_id": platform_message_id,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "content": content,
            "timestamp": timestamp,
            "raw_data": raw_data,
            "created_at": created_at,
        }
    )

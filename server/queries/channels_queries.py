"""Channel and per-channel latest-message reads."""

from __future__ import annotations

from typing import Any

from server.db.database import Database


async def fetch_channel_rows(db: Database) -> list[dict[str, Any]]:
    return await db.fetch_all(
        "SELECT platform, platform_id, channel_name, created_at FROM channels ORDER BY created_at ASC"
    )


async def fetch_source_channel_rows(db: Database) -> list[dict[str, Any]]:
    return await db.fetch_all(
        "SELECT sc.source_id, sc.platform, sc.platform_id "
        "FROM source_channels sc JOIN sources s ON s.id = sc.source_id "
        "ORDER BY s.created_at ASC"
    )


async def fetch_source_rows(db: Database) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT * FROM sources")


async def fetch_latest_message_rows(
    db: Database,
    channel_keys: list[tuple[str, str]],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    values_sql = ", ".join("(?, ?)" for _ in channel_keys)
    params = tuple(value for pair in channel_keys for value in pair) + (limit,)
    return await db.fetch_all(
        "WITH selected(platform, platform_id) AS (VALUES "
        + values_sql
        + "), ranked AS ("
        + "SELECT m.*, c.channel_name, "
        + "ROW_NUMBER() OVER ("
        + "PARTITION BY m.platform, m.platform_id ORDER BY m.timestamp DESC, m.id DESC"
        + ") AS channel_rank "
        + "FROM messages m "
        + "JOIN selected s ON s.platform = m.platform AND s.platform_id = m.platform_id "
        + "LEFT JOIN channels c ON c.platform = m.platform AND c.platform_id = m.platform_id"
        + ") SELECT * FROM ranked WHERE channel_rank <= ? "
        + "ORDER BY platform, platform_id, timestamp DESC, id DESC",
        params,
    )

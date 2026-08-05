"""Database queries backing sources endpoints and source-channel links."""

from __future__ import annotations

from typing import Any

from server.db.database import TransactionDb
from server.ingestion import upsert_channel

# Columns needed by ``serialize_source`` (credentials blob omitted).
SOURCE_LIST_COLUMNS = "id, platform, name, status, last_error, last_connected_at, created_at, updated_at"


async def fetch_source_rows_for_platform(
    db: Any,
    platform: str,
    *,
    include_credentials: bool,
) -> list[dict[str, Any]]:
    if include_credentials:
        return await db.fetch_all(
            "SELECT * FROM sources WHERE platform = ? ORDER BY created_at ASC",
            (platform,),
        )
    return await db.fetch_all(
        f"SELECT {SOURCE_LIST_COLUMNS} FROM sources WHERE platform = ? ORDER BY created_at ASC",
        (platform,),
    )


async def fetch_all_source_list_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all(
        f"SELECT {SOURCE_LIST_COLUMNS} FROM sources ORDER BY created_at ASC",
    )


async def fetch_all_source_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT * FROM sources")


async def insert_source(
    db: Any,
    *,
    source_id: str,
    platform: str,
    name: str,
    status: str,
    credentials: str,
    now: str,
) -> None:
    await db.execute(
        "INSERT INTO sources (id, platform, name, status, credentials, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (source_id, platform, name, status, credentials, now, now),
    )


async def delete_source(db: Any, source_id: str) -> None:
    await db.execute("DELETE FROM sources WHERE id = ?", (source_id,))


async def update_source_name(db: Any, source_id: str, name: str, now: str) -> None:
    await db.execute(
        "UPDATE sources SET name = ?, updated_at = ? WHERE id = ?",
        (name, now, source_id),
    )


async def fetch_source_channel_rows(
    db: Any,
    source_id: str,
    platform: str,
) -> list[dict[str, Any]]:
    return await db.fetch_all(
        "SELECT c.* FROM source_channels sc "
        "JOIN channels c ON c.platform = sc.platform AND c.platform_id = sc.platform_id "
        "WHERE sc.source_id = ? AND sc.platform = ? "
        "ORDER BY c.channel_name ASC",
        (source_id, platform),
    )


async def fetch_source_channel_rows_batch(
    db: Any,
    source_ids: list[str],
    platform: str,
) -> list[dict[str, Any]]:
    if not source_ids:
        return []
    placeholders = ",".join("?" for _ in source_ids)
    return await db.fetch_all(
        f"SELECT sc.source_id, c.* FROM source_channels sc "
        f"JOIN channels c ON c.platform = sc.platform AND c.platform_id = sc.platform_id "
        f"WHERE sc.source_id IN ({placeholders}) AND sc.platform = ? "
        f"ORDER BY sc.source_id ASC, c.channel_name ASC",
        tuple(source_ids + [platform]),
    )


async def fetch_linked_channel_row(
    db: Any,
    source_id: str,
    platform: str,
) -> dict[str, Any] | None:
    return await db.fetch_one(
        "SELECT * FROM channels WHERE platform = ? AND platform_id IN ("
        "SELECT platform_id FROM source_channels WHERE source_id = ? AND platform = ?"
        ")",
        (platform, source_id, platform),
    )


async def fetch_channel_row(
    db: Any,
    platform: str,
    platform_id: str,
) -> dict[str, Any] | None:
    return await db.fetch_one(
        "SELECT * FROM channels WHERE platform = ? AND platform_id = ?",
        (platform, platform_id),
    )


async def bind_source_channel(
    db: Any,
    source_id: str,
    platform: str,
    platform_id: str,
    channel_name: str,
) -> None:
    """Atomically upsert an authoritative channel row and link it to the source."""
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await upsert_channel(tx, platform, platform_id, channel_name, refresh_name=bool(channel_name))
        await conn.execute(
            "INSERT OR IGNORE INTO source_channels (source_id, platform, platform_id) VALUES (?, ?, ?)",
            (source_id, platform, platform_id),
        )


async def sync_source_channels(
    db: Any,
    source_id: str,
    platform: str,
    bindings: list[tuple[str, str]],
) -> None:
    """Atomically replace links, refresh authoritative names, and prune orphans."""
    keep_ids = {platform_id for platform_id, _ in bindings}
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        async with conn.execute(
            "SELECT platform_id FROM source_channels WHERE source_id = ? AND platform = ?",
            (source_id, platform),
        ) as cursor:
            existing = await cursor.fetchall()
        remove_ids = [str(row["platform_id"]) for row in existing if str(row["platform_id"]) not in keep_ids]
        if remove_ids:
            placeholders = ",".join("?" for _ in remove_ids)
            await conn.execute(
                f"DELETE FROM source_channels WHERE source_id = ? AND platform = ? AND platform_id IN ({placeholders})",
                (source_id, platform, *remove_ids),
            )
            await conn.execute(
                f"DELETE FROM channels WHERE platform = ? AND platform_id IN ({placeholders}) AND NOT EXISTS ("
                "SELECT 1 FROM source_channels sc "
                "WHERE sc.platform = channels.platform AND sc.platform_id = channels.platform_id"
                ")",
                (platform, *remove_ids),
            )

        for platform_id, channel_name in bindings:
            await upsert_channel(tx, platform, platform_id, channel_name, refresh_name=bool(channel_name))

        if bindings:
            await conn.executemany(
                "INSERT OR IGNORE INTO source_channels (source_id, platform, platform_id) VALUES (?, ?, ?)",
                [(source_id, platform, platform_id) for platform_id, _ in bindings],
            )

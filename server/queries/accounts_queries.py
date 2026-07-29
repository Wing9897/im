"""Database queries backing accounts endpoints and account-channel links."""

from __future__ import annotations

from typing import Any

from server.db.database import TransactionDb
from server.ingestion import upsert_channel

# Columns needed by ``serialize_account`` (credentials blob omitted).
ACCOUNT_LIST_COLUMNS = "id, platform, name, status, last_error, last_connected_at, created_at, updated_at"


async def fetch_account_rows_for_platform(
    db: Any,
    platform: str,
    *,
    include_credentials: bool,
) -> list[dict[str, Any]]:
    if include_credentials:
        return await db.fetch_all(
            "SELECT * FROM accounts WHERE platform = ? ORDER BY created_at ASC",
            (platform,),
        )
    return await db.fetch_all(
        f"SELECT {ACCOUNT_LIST_COLUMNS} FROM accounts WHERE platform = ? ORDER BY created_at ASC",
        (platform,),
    )


async def fetch_all_account_list_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all(
        f"SELECT {ACCOUNT_LIST_COLUMNS} FROM accounts ORDER BY created_at ASC",
    )


async def fetch_all_account_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT * FROM accounts")


async def insert_account(
    db: Any,
    *,
    account_id: str,
    platform: str,
    name: str,
    status: str,
    credentials: str,
    now: str,
) -> None:
    await db.execute(
        "INSERT INTO accounts (id, platform, name, status, credentials, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (account_id, platform, name, status, credentials, now, now),
    )


async def delete_account(db: Any, account_id: str) -> None:
    await db.execute("DELETE FROM accounts WHERE id = ?", (account_id,))


async def update_account_name(db: Any, account_id: str, name: str, now: str) -> None:
    await db.execute(
        "UPDATE accounts SET name = ?, updated_at = ? WHERE id = ?",
        (name, now, account_id),
    )


async def fetch_account_channel_rows(
    db: Any,
    account_id: str,
    platform: str,
) -> list[dict[str, Any]]:
    return await db.fetch_all(
        "SELECT c.* FROM account_channels ac "
        "JOIN channels c ON c.platform = ac.platform AND c.platform_id = ac.platform_id "
        "WHERE ac.account_id = ? AND ac.platform = ? "
        "ORDER BY c.channel_name ASC",
        (account_id, platform),
    )


async def fetch_account_channel_rows_batch(
    db: Any,
    account_ids: list[str],
    platform: str,
) -> list[dict[str, Any]]:
    if not account_ids:
        return []
    placeholders = ",".join("?" for _ in account_ids)
    return await db.fetch_all(
        f"SELECT ac.account_id, c.* FROM account_channels ac "
        f"JOIN channels c ON c.platform = ac.platform AND c.platform_id = ac.platform_id "
        f"WHERE ac.account_id IN ({placeholders}) AND ac.platform = ? "
        f"ORDER BY ac.account_id ASC, c.channel_name ASC",
        tuple(account_ids + [platform]),
    )


async def fetch_linked_channel_row(
    db: Any,
    account_id: str,
    platform: str,
) -> dict[str, Any] | None:
    return await db.fetch_one(
        "SELECT * FROM channels WHERE platform = ? AND platform_id IN ("
        "SELECT platform_id FROM account_channels WHERE account_id = ? AND platform = ?"
        ")",
        (platform, account_id, platform),
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


async def bind_account_channel(
    db: Any,
    account_id: str,
    platform: str,
    platform_id: str,
    channel_name: str,
) -> None:
    """Atomically upsert an authoritative channel row and link it to the account."""
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await upsert_channel(tx, platform, platform_id, channel_name, refresh_name=bool(channel_name))
        await conn.execute(
            "INSERT OR IGNORE INTO account_channels (account_id, platform, platform_id) VALUES (?, ?, ?)",
            (account_id, platform, platform_id),
        )


async def sync_account_channels(
    db: Any,
    account_id: str,
    platform: str,
    bindings: list[tuple[str, str]],
) -> None:
    """Atomically replace links, refresh authoritative names, and prune orphans."""
    keep_ids = {platform_id for platform_id, _ in bindings}
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        async with conn.execute(
            "SELECT platform_id FROM account_channels WHERE account_id = ? AND platform = ?",
            (account_id, platform),
        ) as cursor:
            existing = await cursor.fetchall()
        remove_ids = [str(row["platform_id"]) for row in existing if str(row["platform_id"]) not in keep_ids]
        if remove_ids:
            placeholders = ",".join("?" for _ in remove_ids)
            await conn.execute(
                f"DELETE FROM account_channels WHERE account_id = ? AND platform = ? "
                f"AND platform_id IN ({placeholders})",
                (account_id, platform, *remove_ids),
            )
            await conn.execute(
                f"DELETE FROM channels WHERE platform = ? AND platform_id IN ({placeholders}) AND NOT EXISTS ("
                "SELECT 1 FROM account_channels ac "
                "WHERE ac.platform = channels.platform AND ac.platform_id = channels.platform_id"
                ")",
                (platform, *remove_ids),
            )

        for platform_id, channel_name in bindings:
            await upsert_channel(tx, platform, platform_id, channel_name, refresh_name=bool(channel_name))

        if bindings:
            await conn.executemany(
                "INSERT OR IGNORE INTO account_channels (account_id, platform, platform_id) VALUES (?, ?, ?)",
                [(account_id, platform, platform_id) for platform_id, _ in bindings],
            )

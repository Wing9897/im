"""Atomic helpers for encrypted account credential mutations."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from server.db.database import Database
from server.secrets import protect_text, unprotect_text
from server.util import parse_json_dict, utc_now_iso


async def mutate_account_credentials(
    db: Database,
    account_id: str,
    mutation: Callable[[dict[str, Any]], dict[str, Any]],
    *,
    name: str | None = None,
) -> dict[str, Any] | None:
    """Read, mutate, and replace encrypted credentials in one DB transaction."""
    async with db.transaction() as conn:
        async with conn.execute("SELECT credentials FROM accounts WHERE id = ?", (account_id,)) as cursor:
            row = await cursor.fetchone()
        if row is None:
            return None

        current = parse_json_dict(unprotect_text(row["credentials"]))
        updated = mutation(dict(current))
        encoded = protect_text(json.dumps(updated, ensure_ascii=False))
        if name is None:
            await conn.execute(
                "UPDATE accounts SET credentials = ?, updated_at = ? WHERE id = ?",
                (encoded, utc_now_iso(), account_id),
            )
        else:
            await conn.execute(
                "UPDATE accounts SET name = ?, credentials = ?, updated_at = ? WHERE id = ?",
                (name, encoded, utc_now_iso(), account_id),
            )
    return updated

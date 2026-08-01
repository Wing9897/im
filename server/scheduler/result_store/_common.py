from __future__ import annotations

from typing import Any


def clean_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


async def existing_message_ids(conn: Any, candidates: set[str]) -> set[str]:
    ids = sorted(c for c in candidates if isinstance(c, str) and c)
    if not ids:
        return set()
    placeholders = ",".join("?" for _ in ids)
    async with conn.execute(f"SELECT id FROM messages WHERE id IN ({placeholders})", tuple(ids)) as cursor:
        rows = await cursor.fetchall()
    return {str(row[0]) for row in rows}

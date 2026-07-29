"""Persist A2A capability call audit rows (never store secrets)."""

from __future__ import annotations

from server.db.database import Database
from server.util import new_id, utc_now_iso


async def write_a2a_audit(
    db: Database,
    *,
    key_id: str,
    capability: str,
    status: str,
    detail: str = "",
) -> None:
    await db.execute(
        """
        INSERT INTO a2a_audit_log (id, key_id, capability, status, detail, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            new_id(),
            str(key_id or ""),
            str(capability or ""),
            str(status or ""),
            str(detail or "")[:500],
            utc_now_iso(),
        ),
    )

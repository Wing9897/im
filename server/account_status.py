"""Shared account status persistence for API routes and collector adapters."""

from __future__ import annotations

from typing import Any, Optional

from server.util import utc_now_iso


async def mark_account_connected(db: Any, account_id: str, *, name: Optional[str] = None) -> None:
    """Persist connected status (optionally renaming the account)."""
    now = utc_now_iso()
    if name is None:
        await db.execute(
            "UPDATE accounts SET status = 'connected', last_error = NULL, "
            "last_connected_at = ?, updated_at = ? WHERE id = ?",
            (now, now, account_id),
        )
    else:
        await db.execute(
            "UPDATE accounts SET status = 'connected', last_error = NULL, name = ?, "
            "last_connected_at = ?, updated_at = ? WHERE id = ?",
            (name, now, now, account_id),
        )


async def set_account_error(db: Any, account_id: str, error: str) -> None:
    await db.execute(
        "UPDATE accounts SET status = 'error', last_error = ?, updated_at = ? WHERE id = ?",
        (error, utc_now_iso(), account_id),
    )


async def update_account_status(
    db: Any,
    account_id: str,
    status: str,
    *,
    last_error: str | None = None,
) -> None:
    """Best-effort persist used by collector adapters during reconnect loops."""
    now = utc_now_iso()
    if status == "connected":
        await db.execute(
            "UPDATE accounts SET status = ?, last_error = NULL, last_connected_at = ?, updated_at = ? WHERE id = ?",
            (status, now, now, account_id),
        )
    else:
        await db.execute(
            "UPDATE accounts SET status = ?, last_error = ?, updated_at = ? WHERE id = ?",
            (status, last_error, now, account_id),
        )

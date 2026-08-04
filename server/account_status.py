"""Shared account status persistence for API routes and collector adapters."""

from __future__ import annotations

import logging
from typing import Any, Optional

from server.app_logging import record, summarize_error_message
from server.util import utc_now_iso

logger = logging.getLogger(__name__)


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


async def _record_account_error(db: Any, account_id: str, error: str) -> None:
    """Best-effort Settings→Logs row for account connect / runtime failures."""
    try:
        row = await db.fetch_one(
            "SELECT name, platform FROM accounts WHERE id = ?",
            (account_id,),
        )
        account_name = str(row["name"]) if row and row.get("name") else account_id
        platform = str(row["platform"]) if row and row.get("platform") else "unknown"
        summary = summarize_error_message(error)
        await record(
            db,
            level="error",
            category="account",
            kind="account.error",
            message=f"Account error ({platform}): {account_name} — {summary}",
            message_key="logs:templates.accountError",
            message_params={
                "accountName": account_name,
                "platform": platform,
                "summary": summary,
            },
            source="server.account_status",
            payload={
                "accountId": account_id,
                "accountName": account_name,
                "platform": platform,
                "error": error,
            },
        )
    except Exception:  # noqa: BLE001 — logging must never block status updates
        logger.exception("Failed to record account.error app log for %s", account_id)


async def set_account_error(db: Any, account_id: str, error: str) -> None:
    await db.execute(
        "UPDATE accounts SET status = 'error', last_error = ?, updated_at = ? WHERE id = ?",
        (error, utc_now_iso(), account_id),
    )
    await _record_account_error(db, account_id, error)


async def update_account_status(
    db: Any,
    account_id: str,
    status: str,
    *,
    last_error: str | None = None,
) -> None:
    """Best-effort persist used by collector adapters during reconnect loops."""
    now = utc_now_iso()
    previous = await db.fetch_one(
        "SELECT status FROM accounts WHERE id = ?",
        (account_id,),
    )
    previous_status = str(previous["status"]) if previous else None
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
    # Log only on transition into error (poll/reconnect loops can re-set error).
    if (
        status == "error"
        and last_error
        and previous_status != "error"
    ):
        await _record_account_error(db, account_id, last_error)

"""Application-log write operations kept out of HTTP routes."""

from typing import Any

from server.db.database import Database
from server.queries.logs_queries import fetch_app_log
from server.util import new_id, utc_now_iso


async def create_app_log(
    db: Database,
    *,
    level: str,
    category: str,
    message: str,
    details: str | None,
) -> dict[str, Any]:
    log_id = new_id()
    await db.execute(
        "INSERT INTO app_logs (id, time, level, category, message, details) VALUES (?, ?, ?, ?, ?, ?)",
        (log_id, utc_now_iso(), level, category, message, details),
    )
    row = await fetch_app_log(db, log_id)
    assert row is not None
    return row


async def clear_app_logs(db: Database) -> None:
    await db.execute("DELETE FROM app_logs")

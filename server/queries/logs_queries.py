"""Read queries for application logs."""

from typing import Any

from server.db.database import Database
from server.queries.pagination import fetch_cursor_page


async def fetch_app_logs_page(
    db: Database,
    *,
    cursor_time: str | None,
    cursor_id: str | None,
    limit: int,
) -> tuple[list[dict[str, Any]], bool, int]:
    total_count = int(await db.fetch_value("SELECT COUNT(*) FROM app_logs") or 0)
    rows, has_more = await fetch_cursor_page(
        db,
        select_sql="SELECT * FROM app_logs",
        where="",
        params=[],
        sort_col="time",
        id_col="id",
        cursor_time=cursor_time,
        cursor_id=cursor_id,
        limit=limit,
    )
    return rows, has_more, total_count


async def fetch_app_log(db: Database, log_id: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM app_logs WHERE id = ?", (log_id,))

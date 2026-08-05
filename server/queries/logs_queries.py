"""Read queries for application logs."""

from typing import Any

from server.db.database import Database
from server.queries.pagination import fetch_cursor_page


def _kind_filters(
    *,
    kind: str | None,
    exclude_kind: str | None,
) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if kind:
        clauses.append("kind = ?")
        params.append(kind)
    if exclude_kind:
        clauses.append("kind != ?")
        params.append(exclude_kind)
    if not clauses:
        return "", []
    return " WHERE " + " AND ".join(clauses), params


async def fetch_app_logs_page(
    db: Database,
    *,
    cursor_time: str | None,
    cursor_id: str | None,
    limit: int,
    kind: str | None = None,
    exclude_kind: str | None = None,
) -> tuple[list[dict[str, Any]], bool, int]:
    where, params = _kind_filters(kind=kind, exclude_kind=exclude_kind)
    total_count = int(await db.fetch_value(f"SELECT COUNT(*) FROM app_logs{where}", tuple(params)) or 0)
    rows, has_more = await fetch_cursor_page(
        db,
        select_sql="SELECT * FROM app_logs",
        where=where,
        params=params,
        sort_col="time",
        id_col="id",
        cursor_time=cursor_time,
        cursor_id=cursor_id,
        limit=limit,
    )
    return rows, has_more, total_count


async def fetch_app_log(db: Database, log_id: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM app_logs WHERE id = ?", (log_id,))

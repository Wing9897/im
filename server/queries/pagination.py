"""Keyset (cursor) and offset pagination shared by list routes.

Keyset paging is used by messages/logs (newest-first). Offset+COUNT paging is
used by action trigger history and analysis events.
"""

from __future__ import annotations

from typing import Any

from server.db.database import Database

MAX_PAGE_LIMIT = 200


def clamp_offset_limit(
    limit: int,
    offset: int,
    *,
    max_limit: int = MAX_PAGE_LIMIT,
) -> tuple[int, int]:
    """Normalize limit/offset for offset-based list endpoints."""
    return min(max(limit, 1), max_limit), max(offset, 0)


def offset_page_has_more(offset: int, row_count: int, total_count: int) -> bool:
    return offset + row_count < total_count


async def fetch_cursor_page(
    db: Database,
    *,
    select_sql: str,
    where: str,
    params: list[Any],
    sort_col: str,
    id_col: str,
    cursor_time: str | None,
    cursor_id: str | None,
    limit: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Return ``(rows, has_more)`` for one keyset page ordered DESC.

    ``where`` is either empty or a full ``" WHERE ..."`` fragment matching
    ``params``; the cursor predicate is appended to it.
    """
    limit = min(max(limit, 1), MAX_PAGE_LIMIT)

    page_where = where
    page_params = list(params)
    if cursor_time and cursor_id:
        connector = " AND " if page_where else " WHERE "
        page_where += f"{connector}({sort_col} < ? OR ({sort_col} = ? AND {id_col} < ?))"
        page_params.extend([cursor_time, cursor_time, cursor_id])

    rows = await db.fetch_all(
        f"{select_sql}{page_where} ORDER BY {sort_col} DESC, {id_col} DESC LIMIT ?",
        tuple(page_params + [limit + 1]),
    )
    has_more = len(rows) > limit
    return rows[:limit], has_more


async def fetch_offset_page(
    db: Database,
    *,
    count_sql: str,
    select_sql: str,
    params: list[Any],
    limit: int,
    offset: int,
) -> tuple[list[dict[str, Any]], int, bool]:
    """Return ``(rows, total_count, has_more)`` for one OFFSET/LIMIT page.

    ``count_sql`` and ``select_sql`` must share the same ``params`` (without
    limit/offset). ``select_sql`` should already include ORDER BY.
    """
    limit, offset = clamp_offset_limit(limit, offset)
    total_count = int(await db.fetch_value(count_sql, tuple(params)) or 0)
    rows = await db.fetch_all(
        f"{select_sql} LIMIT ? OFFSET ?",
        tuple(list(params) + [limit, offset]),
    )
    return rows, total_count, offset_page_has_more(offset, len(rows), total_count)

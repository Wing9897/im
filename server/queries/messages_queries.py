"""Shared message list filters + cursor page fetch (routes + agent tools)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from server.analyzer.incremental import time_range_condition
from server.api.channel_refs import parse_channel_key_csv
from server.db.database import Database
from server.queries.pagination import fetch_cursor_page
from server.wire.serializers import serialize_message

MAX_FILTER_SOURCE_IDS = 100
MAX_FILTER_CHANNEL_IDS = 100
MAX_SEARCH_LENGTH = 500

MESSAGES_FROM = " FROM messages m LEFT JOIN channels c ON c.platform = m.platform AND c.platform_id = m.platform_id"
MESSAGES_SELECT = "SELECT m.*, c.channel_name" + MESSAGES_FROM


class MessagesQueryError(ValueError):
    """Invalid filter inputs; API routes map this to HTTP 422."""


async def message_source_exists(db: Database, source_id: str) -> bool:
    """Whether an optional ingest source FK is valid."""
    return await db.fetch_one("SELECT 1 FROM sources WHERE id = ?", (source_id,)) is not None


def build_message_filters(
    source_ids: str | None,
    time_range: str | None,
    search: str | None,
    platform: str | None,
    channel_ids: str | None,
) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if source_ids:
        ids = [a.strip() for a in source_ids.split(",") if a.strip()]
        if ids:
            if len(ids) > MAX_FILTER_SOURCE_IDS:
                raise MessagesQueryError(f"A maximum of {MAX_FILTER_SOURCE_IDS} source ids may be filtered")
            clauses.append(f"m.source_id IN ({','.join('?' for _ in ids)})")
            params.extend(ids)
    time_sql, time_params = time_range_condition(time_range)
    if time_sql:
        clauses.append(time_sql)
        params.extend(time_params)
    if search:
        if len(search) > MAX_SEARCH_LENGTH:
            raise MessagesQueryError(f"search must not exceed {MAX_SEARCH_LENGTH} characters")
        clauses.append("(m.content LIKE ? OR m.sender_name LIKE ? OR m.sender_id LIKE ? OR c.channel_name LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like, like])
    if platform:
        clauses.append("m.platform = ?")
        params.append(platform)
    if channel_ids:
        try:
            channel_pairs = parse_channel_key_csv(channel_ids, max_keys=MAX_FILTER_CHANNEL_IDS)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            raise MessagesQueryError(detail) from exc
        if channel_pairs:
            clauses.append("(" + " OR ".join("(m.platform = ? AND m.platform_id = ?)" for _ in channel_pairs) + ")")
            for channel_platform, platform_id in channel_pairs:
                params.extend([channel_platform, platform_id])
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


async def fetch_messages_page(
    db: Database,
    *,
    source_ids: str | None = None,
    time_range: str | None = None,
    search: str | None = None,
    platform: str | None = None,
    channel_ids: str | None = None,
    cursor_time: str | None = None,
    cursor_id: str | None = None,
    limit: int = 50,
    include_total: bool = True,
) -> dict[str, Any]:
    where, params = build_message_filters(source_ids, time_range, search, platform, channel_ids)

    total_count = None
    if include_total:
        total_count = int(await db.fetch_value("SELECT COUNT(*)" + MESSAGES_FROM + where, tuple(params)) or 0)

    rows, has_more = await fetch_cursor_page(
        db,
        select_sql=MESSAGES_SELECT,
        where=where,
        params=params,
        sort_col="m.timestamp",
        id_col="m.id",
        cursor_time=cursor_time,
        cursor_id=cursor_id,
        limit=limit,
    )
    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        next_cursor = {"timestamp": last["timestamp"], "id": last["id"]}
    return {
        "messages": [serialize_message(row) for row in rows],
        "nextCursor": next_cursor,
        "hasMore": has_more,
        "totalCount": total_count,
    }

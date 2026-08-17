"""Local collected-message search tools for the Agent runtime."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from server.agent.tool_args import arg, as_int
from server.agent.tool_limits import (
    MESSAGES_DEFAULT_RESULT_LIMIT,
    MESSAGES_RESULT_HARD_CAP,
)
from server.db.database import Database
from server.domain.mcp_workset_scope import allowed_workset_ids_from_args
from server.queries.messages_queries import (
    MAX_SEARCH_LENGTH,
    MessagesQueryError,
    fetch_messages_page,
)

# Alias retained for tests and external imports.
HARD_CAP = MESSAGES_RESULT_HARD_CAP
CONTENT_TRUNCATE = 400
DEFAULT_TIME_RANGE = "7d"
_BOUNDED_TIME_RANGE_TOKENS = frozenset({"today", "1h", "6h", "12h", "24h", "48h", "1d", "7d", "30d"})

ToolHandler = Callable[[Database, dict[str, Any]], Awaitable[dict[str, Any]]]


def _as_csv(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, (list, tuple)):
        parts = [str(item).strip() for item in value if str(item).strip()]
        return ",".join(parts) if parts else None
    return str(value).strip() or None


def _resolve_time_range(raw: Any) -> tuple[str, str | None]:
    """Return (reported token, query token or None for no filter).

    Omitted → default ``7d``. Explicit ``all`` → no time filter.
    Supported bounded tokens pass through to ``time_range_condition``.
    """
    if raw is None or raw == "":
        return DEFAULT_TIME_RANGE, DEFAULT_TIME_RANGE
    token = str(raw).strip()
    if not token:
        return DEFAULT_TIME_RANGE, DEFAULT_TIME_RANGE
    canonical = token.lower()
    if canonical == "all":
        return "all", None
    if canonical not in _BOUNDED_TIME_RANGE_TOKENS:
        raise MessagesQueryError("timeRange must be 'all', 'today', or a supported offset")
    return canonical, canonical


def _compact_message(row: dict[str, Any]) -> dict[str, Any]:
    content = str(row.get("content") or "")
    if len(content) > CONTENT_TRUNCATE:
        content = content[: CONTENT_TRUNCATE - 1] + "…"
    return {
        "id": row.get("id"),
        "platform": row.get("platform"),
        "channelName": row.get("channelName"),
        "senderName": row.get("senderName"),
        "content": content,
        "timestamp": row.get("timestamp"),
    }


async def _tool_messages_search(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    query = arg(args, "query", "q", "search")
    if query is None or not str(query).strip():
        return {"error": "query is required", "items": [], "count": 0}
    query_text = str(query).strip()
    if len(query_text) > MAX_SEARCH_LENGTH:
        return {
            "error": f"query must not exceed {MAX_SEARCH_LENGTH} characters",
            "items": [],
            "count": 0,
        }

    limit = min(
        max(as_int(args.get("limit"), MESSAGES_DEFAULT_RESULT_LIMIT), 1),
        MESSAGES_RESULT_HARD_CAP,
    )
    try:
        reported_range, query_range = _resolve_time_range(arg(args, "timeRange", "time_range"))
    except MessagesQueryError as exc:
        return {"error": str(exc), "items": [], "count": 0}
    platform = args.get("platform")
    source_ids = _as_csv(arg(args, "sourceIds", "source_ids"))
    channel_ids = _as_csv(arg(args, "channelIds", "channel_ids"))

    try:
        page = await fetch_messages_page(
            db,
            search=query_text,
            time_range=query_range,
            platform=str(platform) if platform not in (None, "") else None,
            source_ids=source_ids,
            channel_ids=channel_ids,
            limit=limit,
            include_total=False,
            workset_ids=allowed_workset_ids_from_args(args),
        )
    except MessagesQueryError as exc:
        return {"error": str(exc), "items": [], "count": 0}

    items = [_compact_message(row) for row in page.get("messages") or []]
    return {
        "items": items,
        "count": len(items),
        "hasMore": bool(page.get("hasMore")),
        "limit": limit,
        "timeRange": reported_range,
    }


TOOL_HANDLERS: dict[str, ToolHandler] = {
    "messages.search": _tool_messages_search,
}

TOOL_NAMES = frozenset(TOOL_HANDLERS)

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "messages.search",
        "description": (
            "Search locally collected intelligence messages (SQLite LIKE on content / "
            "sender / channel). Use for questions about already-ingested chat/feed data. "
            "Do not invent local messages. Default timeRange is 7d (last 7 days including "
            "today); omit timeRange to use that default. Pass timeRange=today when the "
            "user asks about today. Pass timeRange=all only for full-library "
            f"search. Limit always applies (default {MESSAGES_DEFAULT_RESULT_LIMIT}, "
            f"max {MESSAGES_RESULT_HARD_CAP})."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Required search text (matched with LIKE)",
                },
                "platform": {
                    "type": "string",
                    "description": "Optional platform filter (telegram, discord, rss, …)",
                },
                "timeRange": {
                    "type": "string",
                    "description": (
                        "Time window token: today, 1d, 7d, 30d, …. Default when omitted: 7d. "
                        "Use all for no time filter (full library + limit)."
                    ),
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MESSAGES_RESULT_HARD_CAP,
                },
                "sourceIds": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional source id filter",
                },
                "channelIds": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional channel keys as platform:platformId",
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
]


async def execute_messages_tool(db: Database, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    return await handler(db, arguments or {})

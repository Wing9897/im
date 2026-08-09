"""Web search tool for the Agent runtime (multi-provider)."""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from server.db.database import Database
from server.web_search.execution import ASSISTANT_TOOL_DEFAULT_COUNT, WebSearchExecutionService
from server.web_search.providers import MAX_COUNT

ToolHandler = Callable[[Database, dict[str, Any], dict[str, Any]], Awaitable[dict[str, Any]]]


async def _tool_web_search(
    _db: Database,
    args: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    provider = str(context.get("web_search_provider") or "duckduckgo")
    enabled = bool(context.get("web_search_enabled", True))
    query = args.get("query") or args.get("q")
    raw_count = args.get("count")
    count: int | None
    try:
        count = int(raw_count) if raw_count not in (None, "") else None
    except (TypeError, ValueError):
        count = None
    # Default count stays a param (assistant 5 vs agent-tick provider cap 8) — not a forked copy.
    if count is None:
        count = ASSISTANT_TOOL_DEFAULT_COUNT
    service = WebSearchExecutionService(
        brave_api_key=str(context.get("brave_search_api_key") or ""),
    )
    return await service.tool_search(
        str(query).strip() if query is not None else "",
        provider=provider,
        count=count,
        enabled=enabled,
    )


TOOL_HANDLERS: dict[str, ToolHandler] = {
    "web.search": _tool_web_search,
}

TOOL_NAMES = frozenset(TOOL_HANDLERS)

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "web.search",
        "description": (
            "Search the public web for external / real-time information. "
            "Use only when local messages/calendar are insufficient, the user asks to verify "
            "online, or the question needs current external facts. Cite that results are from "
            "the network, not local intelligence. Default count 5, max 8. "
            "Provider is chosen in settings (duckduckgo default; brave needs an API key)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (required)"},
                "count": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_COUNT,
                    "description": "Max results (default 5, max 8)",
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
]


async def execute_web_search_tool(
    db: Database,
    name: str,
    arguments: dict[str, Any] | None,
    *,
    context: dict[str, Any],
) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    return await handler(db, arguments or {}, context)

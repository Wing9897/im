"""Web search tool for the Agent runtime (multi-provider)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from server.db.database import Database
from server.web_search.execution import ASSISTANT_TOOL_DEFAULT_COUNT, WebSearchExecutionService, api_keys_from_mapping
from server.web_search.page_fetch import MAX_CHARS, MAX_FETCHES_PER_TURN, tool_fetch_page
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
    service = WebSearchExecutionService(api_keys=api_keys_from_mapping(context))
    return await service.tool_search(
        str(query).strip() if query is not None else "",
        provider=provider,
        count=count,
        enabled=enabled,
    )


async def _tool_web_fetch(
    _db: Database,
    args: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    enabled = bool(context.get("web_search_enabled", True))
    url = args.get("url") or args.get("href") or args.get("link")
    return await tool_fetch_page(
        str(url).strip() if url is not None else "",
        enabled=enabled,
        context=context,
    )


TOOL_HANDLERS: dict[str, ToolHandler] = {
    "web.search": _tool_web_search,
    "web.fetch": _tool_web_fetch,
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
            "Provider is chosen in settings (duckduckgo default; brave / tavily / perplexity / serper need an API key)."
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
    {
        "name": "web.fetch",
        "description": (
            "Fetch readable main text from one public HTTP/HTTPS HTML page. "
            "Use only after web.search when a snippet lacks a quote, number, or detail. "
            f"Max {MAX_FETCHES_PER_TURN} fetches per turn; do not visit every search result. "
            f"Text is capped at about {MAX_CHARS} characters; longer pages are truncated. "
            "Fails closed on blocked/private URLs, timeouts, non-HTML, or oversized bodies."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Absolute http(s) URL to fetch (required)"},
            },
            "required": ["url"],
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

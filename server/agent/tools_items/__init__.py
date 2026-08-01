"""Items tools for the Agent runtime."""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from server.agent.tools_items.handlers import _tool_create, _tool_list_expiring
from server.agent.tools_items.schemas import TOOL_SCHEMAS
from server.db.database import Database

ToolHandler = Callable[[Database, dict[str, Any]], Awaitable[dict[str, Any]]]

TOOL_HANDLERS: dict[str, ToolHandler] = {
    "items.list_expiring": _tool_list_expiring,
    "items.create": _tool_create,
}

TOOL_NAMES = frozenset(TOOL_HANDLERS)

__all__ = [
    "TOOL_HANDLERS",
    "TOOL_NAMES",
    "TOOL_SCHEMAS",
    "ToolHandler",
    "execute_items_tool",
]


async def execute_items_tool(db: Database, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    return await handler(db, arguments or {})

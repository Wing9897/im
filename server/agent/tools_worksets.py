"""Read-only worksets.list tool (assistant + MCP + A2A shared handler)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from server.db.database import Database
from server.domain.workset_scope import allowed_workset_ids_from_args
from server.queries.worksets_queries import fetch_all_workset_rows

ToolHandler = Callable[[Database, dict[str, Any]], Awaitable[dict[str, Any]]]

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "worksets.list",
        "description": (
            "List household worksets (id, name, notifyEnabled, externalEnabled). "
            "Use to resolve a worksetId before creating items or calendar rows. "
            "Read-only — there is no create/delete workset tool. "
            "Builtin 一般 is id __general__."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
]


def _compact_workset(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "notifyEnabled": bool(row.get("notify_enabled", 1)),
        "externalEnabled": bool(row.get("external_enabled", 1)),
    }


async def _tool_list(db: Database, arguments: dict[str, Any]) -> dict[str, Any]:
    rows = await fetch_all_workset_rows(db)
    allowed = allowed_workset_ids_from_args(arguments)
    if allowed is not None:
        allowed_set = set(allowed)
        rows = [row for row in rows if str(row.get("id") or "") in allowed_set]
    worksets = [_compact_workset(row) for row in rows]
    return {"worksets": worksets, "count": len(worksets)}


TOOL_HANDLERS: dict[str, ToolHandler] = {
    "worksets.list": _tool_list,
}

TOOL_NAMES = frozenset(TOOL_HANDLERS)

__all__ = [
    "TOOL_HANDLERS",
    "TOOL_NAMES",
    "TOOL_SCHEMAS",
    "ToolHandler",
]

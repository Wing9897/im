"""Task-editor advisor tool for the Agent runtime (gated by surface)."""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from server.analyzer.engine import AnalysisEngine
from server.db.database import Database

#: Stable tool id — keep in sync with frontend ``TASKS_CONSULT_ADVISOR_TOOL``.
CONSULT_ADVISOR_TOOL_NAME = "tasks.consult_advisor"

ToolHandler = Callable[[Database, dict[str, Any], dict[str, Any]], Awaitable[dict[str, Any]]]


async def _tool_consult_advisor(
    db: Database,
    args: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    instruction = args.get("instruction")
    if instruction is None or not str(instruction).strip():
        return {"error": "instruction is required", "message": "", "taskConfig": None}
    engine = AnalysisEngine(db)
    try:
        result = await engine.consult_task_advisor(
            str(instruction).strip(),
            current_task=context.get("current_task"),
            locale=context.get("locale"),
        )
    finally:
        await engine.close()
    return {
        "message": result.get("message") or "",
        "taskConfig": result.get("taskConfig"),
    }


TOOL_HANDLERS: dict[str, ToolHandler] = {
    CONSULT_ADVISOR_TOOL_NAME: _tool_consult_advisor,
}

TOOL_NAMES = frozenset(TOOL_HANDLERS)

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": CONSULT_ADVISOR_TOOL_NAME,
        "description": (
            "Delegate to the task-form advisor when the user wants to create or edit "
            "an analysis task on the task editor page. Pass a clear natural-language "
            "instruction describing the desired form changes. Returns a user-facing "
            "message and optional taskConfig fields to apply to the form. "
            "Do not invent a full taskConfig yourself."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": "Natural-language instruction for the task advisor (required)",
                },
            },
            "required": ["instruction"],
            "additionalProperties": False,
        },
    },
]


async def execute_tasks_tool(
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

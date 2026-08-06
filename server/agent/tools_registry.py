"""Unified Agent tool registry (calendar + messages + intelligence + conditional tools)."""

from __future__ import annotations

from typing import Any

from server.agent.project_scope import apply_project_scope
from server.agent.tools_calendar import TOOL_HANDLERS as CALENDAR_HANDLERS
from server.agent.tools_calendar import TOOL_SCHEMAS as CALENDAR_SCHEMAS
from server.agent.tools_intelligence import TOOL_HANDLERS as INTELLIGENCE_HANDLERS
from server.agent.tools_intelligence import TOOL_SCHEMAS as INTELLIGENCE_SCHEMAS
from server.agent.tools_items import TOOL_HANDLERS as ITEMS_HANDLERS
from server.agent.tools_items import TOOL_SCHEMAS as ITEMS_SCHEMAS
from server.agent.tools_messages import TOOL_HANDLERS as MESSAGES_HANDLERS
from server.agent.tools_messages import TOOL_SCHEMAS as MESSAGES_SCHEMAS
from server.agent.tools_tasks import TOOL_NAMES as TASKS_TOOL_NAMES
from server.agent.tools_tasks import TOOL_SCHEMAS as TASKS_SCHEMAS
from server.agent.tools_tasks import execute_tasks_tool
from server.agent.tools_web_search import TOOL_HANDLERS as WEB_HANDLERS
from server.agent.tools_web_search import TOOL_SCHEMAS as WEB_SCHEMAS
from server.agent.tools_web_search import execute_web_search_tool
from server.db.database import Database
from server.sse import publish_resource_modified

#: Handlers with signature ``(db, arguments)`` — calendar + messages + intelligence + items.
BASE_TOOL_HANDLERS: dict[str, Any] = {
    **CALENDAR_HANDLERS,
    **MESSAGES_HANDLERS,
    **INTELLIGENCE_HANDLERS,
    **ITEMS_HANDLERS,
}

BASE_TOOL_SCHEMAS: list[dict[str, Any]] = [
    *CALENDAR_SCHEMAS,
    *MESSAGES_SCHEMAS,
    *INTELLIGENCE_SCHEMAS,
    *ITEMS_SCHEMAS,
]

WEB_TOOL_NAMES = frozenset(WEB_HANDLERS)

#: Calendar mutation tools (web_intel channel omits / blocks these).
CALENDAR_WRITE_TOOL_NAMES = frozenset(
    {
        "calendar.create_event",
        "calendar.create_recurring_task",
        "calendar.update_recurring_task",
        "calendar.delete_recurring_task",
        "calendar.update_event",
        "calendar.delete_event",
        "calendar.mark_important",
        "calendar.unmark_important",
    }
)

CALENDAR_READ_TOOL_NAMES = frozenset(
    {
        "calendar.list_calendars",
        "calendar.upcoming",
        "calendar.recent",
        "calendar.window",
        "calendar.get",
    }
)

INTELLIGENCE_READ_TOOL_NAMES = frozenset(INTELLIGENCE_HANDLERS)
ITEMS_READ_TOOL_NAMES = frozenset({"items.list_expiring"})


def build_tool_schemas(
    *,
    web_search_enabled: bool,
    task_advisor_enabled: bool = False,
    calendar_writes_enabled: bool = True,
    calendar_read_enabled: bool = True,
    analysis_events_read_enabled: bool = True,
    items_read_enabled: bool = True,
) -> list[dict[str, Any]]:
    schemas = list(BASE_TOOL_SCHEMAS)
    if not calendar_writes_enabled:
        schemas = [s for s in schemas if str(s.get("name") or "") not in CALENDAR_WRITE_TOOL_NAMES]
    if not calendar_read_enabled:
        schemas = [s for s in schemas if str(s.get("name") or "") not in CALENDAR_READ_TOOL_NAMES]
    if not analysis_events_read_enabled:
        schemas = [s for s in schemas if str(s.get("name") or "") not in INTELLIGENCE_READ_TOOL_NAMES]
    if not items_read_enabled:
        schemas = [s for s in schemas if str(s.get("name") or "") not in ITEMS_READ_TOOL_NAMES]
    if web_search_enabled:
        schemas.extend(WEB_SCHEMAS)
    if task_advisor_enabled:
        schemas.extend(TASKS_SCHEMAS)
    return schemas


def _nested_id(result: dict[str, Any], key: str) -> str | None:
    nested = result.get(key)
    return str(nested["id"]) if isinstance(nested, dict) and nested.get("id") else None


def _deleted_task_id(result: dict[str, Any]) -> str | None:
    """Soft-delete keeps the row, so the id may come back under any of three keys."""
    if not result.get("deleted"):
        return None
    task_id = _nested_id(result, "task") or result.get("id") or result.get("taskId")
    return str(task_id) if task_id else None


def _deleted_event_id(result: dict[str, Any]) -> str | None:
    event_id = result.get("id") if result.get("deleted") else None
    return str(event_id) if event_id else None


#: Tool name → (resourceType, action, id extractor). ``calendar.delete_recurring_task``
#: is a soft delete (``isActive=false``), so it publishes "updated" to keep the row
#: in the task catalog instead of announcing it as gone.
_WRITE_NOTIFICATIONS: dict[str, tuple[str, str, Any]] = {
    "calendar.create_recurring_task": ("task", "created", lambda r: _nested_id(r, "task")),
    "calendar.update_recurring_task": ("task", "updated", lambda r: _nested_id(r, "task")),
    "calendar.delete_recurring_task": ("task", "updated", _deleted_task_id),
    "calendar.create_event": ("user_event", "created", lambda r: _nested_id(r, "item")),
    "calendar.update_event": ("user_event", "updated", lambda r: _nested_id(r, "item")),
    "calendar.delete_event": ("user_event", "deleted", _deleted_event_id),
    "items.create": ("item", "created", lambda r: _nested_id(r, "item")),
}


_IMPORTANCE_RESOURCE_TYPE: dict[str, str] = {
    "analysis": "task",
    "recurring": "task",
    "user": "user_event",
    "item": "item",
}


def _publish_calendar_write_side_effects(
    name: str,
    result: dict[str, Any],
    context: dict[str, Any] | None,
) -> None:
    if result.get("error") or not context:
        return
    if name in {"calendar.mark_important", "calendar.unmark_important"}:
        source = str(result.get("source") or "")
        resource_type = _IMPORTANCE_RESOURCE_TYPE.get(source)
        resource_id = result.get("id")
        if resource_type and resource_id:
            publish_resource_modified(
                context.get("broadcaster"),
                resource_type=resource_type,
                resource_id=str(resource_id),
                action="important" if name == "calendar.mark_important" else "unimportant",
            )
        return
    notification = _WRITE_NOTIFICATIONS.get(name)
    if notification is None:
        return
    resource_type, action, extract_id = notification
    resource_id = extract_id(result)
    if not resource_id:
        return
    publish_resource_modified(
        context.get("broadcaster"),
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
    )


async def execute_tool(
    db: Database,
    name: str,
    arguments: dict[str, Any] | None,
    *,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Dispatch by tool name. Web/task tools need context; others only need db."""
    args = dict(arguments or {})
    ctx = context or {}
    if name in CALENDAR_WRITE_TOOL_NAMES and ctx.get("calendar_writes_enabled") is False:
        return {"error": "calendar_writes_disabled"}
    if name in CALENDAR_READ_TOOL_NAMES and ctx.get("calendar_read_enabled") is False:
        return {"error": "calendar_read_disabled"}
    if name in INTELLIGENCE_READ_TOOL_NAMES and ctx.get("analysis_events_read_enabled") is False:
        return {"error": "analysis_events_read_disabled"}
    if name in ITEMS_READ_TOOL_NAMES and ctx.get("items_read_enabled") is False:
        return {"error": "items_read_disabled"}
    project_id = ctx.get("project_scope_task_id")
    if project_id:
        scoped_error = await apply_project_scope(db, name, args, project_id=str(project_id))
        if scoped_error is not None:
            return scoped_error
    if name == "calendar.create_event" and context:
        origin = context.get("user_event_origin")
        if origin:
            args["_origin"] = origin
        # Default target workset from chat request when the tool omits worksetId.
        if "worksetId" not in args and "workset_id" not in args:
            default_wid = context.get("default_workset_id")
            if default_wid is not None:
                args["_default_workset_id"] = default_wid
    if name == "items.create" and context:
        if "worksetId" not in args and "workset_id" not in args:
            default_wid = context.get("default_workset_id")
            if default_wid is not None:
                args["_default_workset_id"] = default_wid
    if name in WEB_TOOL_NAMES:
        return await execute_web_search_tool(db, name, args, context=ctx)
    if name in TASKS_TOOL_NAMES:
        if not ctx.get("task_advisor_enabled"):
            return {"error": "task_advisor_unavailable"}
        return await execute_tasks_tool(db, name, args, context=ctx)
    handler = BASE_TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    result = await handler(db, args)
    if isinstance(result, dict):
        _publish_calendar_write_side_effects(name, result, context)
    return result

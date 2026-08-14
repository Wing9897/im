"""MCP control-plane tool façade: base-19 allowlist → ``execute_tool``.

No ``web.search`` / ``tasks.consult_advisor``. Calendar writes stamp
``user_events.origin = mcp``. Capability groups (system_config) filter
``list_tools`` / ``call_tool``; default all enabled. Master switch
``mcp_enabled`` gates the HTTP control plane (see routes).
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from server.agent.tools_registry import (
    BASE_TOOL_HANDLERS,
    CALENDAR_READ_TOOL_NAMES,
    CALENDAR_WRITE_TOOL_NAMES,
    INTELLIGENCE_READ_TOOL_NAMES,
    ITEMS_READ_TOOL_NAMES,
    ITEMS_WRITE_TOOL_NAMES,
    MESSAGES_TOOL_NAMES,
    build_tool_schemas,
    execute_tool,
)
from server.config import get_config_bool
from server.db.database import Database
from server.domain.mcp_capabilities import (
    MCP_CAPABILITY_CONFIG_KEYS,
    MCP_CAPABILITY_IDS,
)

#: Exactly the base tool set (calendar + messages + intelligence + items).
MCP_TOOL_ALLOWLIST = frozenset(BASE_TOOL_HANDLERS)

#: Destructive calendar deletes that require ``confirm=true`` on the MCP path only.
MCP_CONFIRM_DELETE_TOOLS = frozenset(
    {
        "calendar.delete_event",
        "calendar.delete_recurring_series",
    }
)

MCP_CONFIRM_REQUIRED_ERROR = "confirm required: pass confirm=true to delete via MCP; retry with arguments.confirm=true"

#: Capability group id → tools in that group (partition of the allowlist).
#: Ids come from ``MCP_CAPABILITY_IDS``; membership stays next to the tools registry.
_CAPABILITY_TOOL_SETS: dict[str, frozenset[str]] = {
    "calendar_read": CALENDAR_READ_TOOL_NAMES,
    "calendar_write": CALENDAR_WRITE_TOOL_NAMES,
    "messages_search": MESSAGES_TOOL_NAMES,
    "intelligence_search": INTELLIGENCE_READ_TOOL_NAMES,
    "items_read": ITEMS_READ_TOOL_NAMES,
    "items_write": ITEMS_WRITE_TOOL_NAMES,
}
assert set(_CAPABILITY_TOOL_SETS) == set(MCP_CAPABILITY_IDS), (
    "MCP capability tool map must cover domain MCP_CAPABILITY_IDS exactly"
)

MCP_CAPABILITY_TOOLS: dict[str, frozenset[str]] = {
    cap_id: _CAPABILITY_TOOL_SETS[cap_id] for cap_id in MCP_CAPABILITY_IDS
}

_TOOL_TO_CAPABILITY: dict[str, str] = {tool: cap for cap, tools in MCP_CAPABILITY_TOOLS.items() for tool in tools}


@dataclass(frozen=True, slots=True)
class McpCapabilities:
    calendar_read: bool = True
    calendar_write: bool = True
    messages_search: bool = True
    intelligence_search: bool = True
    items_read: bool = True
    items_write: bool = True

    def enabled(self, capability: str) -> bool:
        return bool(getattr(self, capability, False))


MCP_CAPABILITIES_DEFAULT = McpCapabilities()


async def is_mcp_enabled(db: Database) -> bool:
    """Household master switch for the MCP HTTP control plane (default on)."""
    return await get_config_bool(db, "mcp_enabled")


async def load_mcp_capabilities(db: Database) -> McpCapabilities:
    """Load MCP capability toggles from ``system_config`` (default all on)."""
    values: dict[str, bool] = {}
    for config_key, cap_id in MCP_CAPABILITY_CONFIG_KEYS.items():
        values[cap_id] = await get_config_bool(db, config_key)
    return McpCapabilities(**values)


def mcp_capability_for_tool(name: str) -> str | None:
    return _TOOL_TO_CAPABILITY.get(name)


def _annotate_mcp_delete_confirm(schema: dict[str, Any]) -> dict[str, Any]:
    """Require ``confirm=true`` in MCP-exposed schemas for calendar deletes."""
    name = str(schema.get("name") or "")
    if name not in MCP_CONFIRM_DELETE_TOOLS:
        return schema
    annotated = deepcopy(schema)
    desc = str(annotated.get("description") or "").rstrip()
    note = " MCP requires confirm=true in arguments (dangerous write guard)."
    if "confirm=true" not in desc:
        annotated["description"] = f"{desc}{note}"
    params = annotated.get("parameters")
    if not isinstance(params, dict):
        return annotated
    props = dict(params.get("properties") or {})
    props["confirm"] = {
        "type": "boolean",
        "description": "Must be true to confirm this destructive MCP delete.",
    }
    required = list(params.get("required") or [])
    if "confirm" not in required:
        required.append("confirm")
    annotated["parameters"] = {
        **params,
        "properties": props,
        "required": required,
    }
    return annotated


def mcp_tool_schemas(caps: McpCapabilities | None = None) -> list[dict[str, Any]]:
    """OpenAI-style tool schemas for enabled MCP capability groups (base allowlist only)."""
    active = caps if caps is not None else MCP_CAPABILITIES_DEFAULT
    schemas = build_tool_schemas(
        web_search_enabled=False,
        task_advisor_enabled=False,
        calendar_writes_enabled=active.calendar_write,
        calendar_read_enabled=active.calendar_read,
        analysis_events_read_enabled=active.intelligence_search,
        messages_search_enabled=active.messages_search,
        items_read_enabled=active.items_read,
        items_writes_enabled=active.items_write,
    )
    return [_annotate_mcp_delete_confirm(s) for s in schemas]


def openai_schema_to_mcp_input_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Map our OpenAI-style ``parameters`` object to MCP ``inputSchema``."""
    params = schema.get("parameters")
    if isinstance(params, dict):
        return params
    return {"type": "object", "properties": {}}


def mcp_status_tools(caps: McpCapabilities | None = None) -> list[dict[str, str]]:
    """``{name, description}`` rows for ``GET /mcp/status`` (capability-filtered)."""
    return [
        {
            "name": str(schema["name"]),
            "description": str(schema.get("description") or ""),
        }
        for schema in mcp_tool_schemas(caps)
    ]


async def execute_mcp_tool(
    db: Database,
    name: str,
    arguments: dict[str, Any] | None,
    *,
    broadcaster: Any = None,
    caps: McpCapabilities | None = None,
) -> dict[str, Any]:
    """Allowlist + capability-check then dispatch via ``execute_tool`` with MCP origin."""
    if name not in MCP_TOOL_ALLOWLIST:
        return {"error": f"tool not allowed: {name}"}
    active = caps if caps is not None else await load_mcp_capabilities(db)
    capability = mcp_capability_for_tool(name)
    if capability is not None and not active.enabled(capability):
        return {"error": f"mcp capability disabled: {capability}"}
    args = dict(arguments or {})
    if name in MCP_CONFIRM_DELETE_TOOLS and args.get("confirm") is not True:
        return {"error": MCP_CONFIRM_REQUIRED_ERROR}
    return await execute_tool(
        db,
        name,
        args,
        context={
            "user_event_origin": "mcp",
            "broadcaster": broadcaster,
            "calendar_writes_enabled": active.calendar_write,
            "calendar_read_enabled": active.calendar_read,
            "analysis_events_read_enabled": active.intelligence_search,
            "items_read_enabled": active.items_read,
            "items_writes_enabled": active.items_write,
        },
    )

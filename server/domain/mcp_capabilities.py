"""Single source of truth for MCP capability group ids and settings keys.

Tool membership lives in ``server.agent.mcp_tools`` (needs the tools registry).
``CONFIG_DEFAULTS`` / settings wire maps / ``McpCapabilities`` fields derive
from ``MCP_CAPABILITY_SPECS`` so the three surfaces cannot drift.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True, slots=True)
class McpCapabilitySpec:
    """One household-level MCP capability group (settings toggle)."""

    id: str
    #: ``system_config`` key (also ``CONFIG_DEFAULTS``).
    config_key: str
    #: ``SystemSettingsSnapshot`` / PUT settings camelCase wire key.
    wire_key: str


MCP_CAPABILITY_SPECS: Final[tuple[McpCapabilitySpec, ...]] = (
    McpCapabilitySpec("calendar_read", "mcp_cap_calendar_read", "mcpCapCalendarRead"),
    McpCapabilitySpec("calendar_write", "mcp_cap_calendar_write", "mcpCapCalendarWrite"),
    McpCapabilitySpec("messages_search", "mcp_cap_messages_search", "mcpCapMessagesSearch"),
    McpCapabilitySpec(
        "intelligence_search",
        "mcp_cap_intelligence_search",
        "mcpCapIntelligenceSearch",
    ),
    McpCapabilitySpec("items_read", "mcp_cap_items_read", "mcpCapItemsRead"),
    McpCapabilitySpec("items_write", "mcp_cap_items_write", "mcpCapItemsWrite"),
)

MCP_CAPABILITY_IDS: Final[tuple[str, ...]] = tuple(spec.id for spec in MCP_CAPABILITY_SPECS)

#: ``system_config`` defaults for capability toggles (all on).
MCP_CAPABILITY_CONFIG_DEFAULTS: Final[dict[str, str]] = {spec.config_key: "true" for spec in MCP_CAPABILITY_SPECS}

#: Settings wire key → ``system_config`` key.
MCP_CAPABILITY_SETTINGS_KEYS: Final[dict[str, str]] = {spec.wire_key: spec.config_key for spec in MCP_CAPABILITY_SPECS}

#: ``system_config`` key → capability id (for loaders).
MCP_CAPABILITY_CONFIG_KEYS: Final[dict[str, str]] = {spec.config_key: spec.id for spec in MCP_CAPABILITY_SPECS}

MCP_CAPABILITY_WIRE_KEYS: Final[frozenset[str]] = frozenset(MCP_CAPABILITY_SETTINGS_KEYS)

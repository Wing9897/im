"""Single source of truth for ``user_events.origin`` vocabulary.

DDL CHECK in ``server/db/schema_domains/calendar.py`` embeds
``USER_EVENT_ORIGIN_CHECK_SQL`` (asserted equal to ``ALL_USER_EVENT_ORIGINS``
by drift test).
"""

from __future__ import annotations

from typing import Final, Literal

ORIGIN_MANUAL: Final = "manual"
ORIGIN_ASSISTANT: Final = "assistant"
ORIGIN_A2A: Final = "a2a"
ORIGIN_AGENT: Final = "agent"
ORIGIN_ICS: Final = "ics"
ORIGIN_MCP: Final = "mcp"

UserEventOrigin = Literal[
    "manual",
    "assistant",
    "a2a",
    "agent",
    "ics",
    "mcp",
]

ALL_USER_EVENT_ORIGINS: Final[tuple[UserEventOrigin, ...]] = (
    ORIGIN_MANUAL,
    ORIGIN_ASSISTANT,
    ORIGIN_A2A,
    ORIGIN_AGENT,
    ORIGIN_ICS,
    ORIGIN_MCP,
)

ALLOWED_USER_EVENT_ORIGINS: Final[frozenset[str]] = frozenset(ALL_USER_EVENT_ORIGINS)

#: Origins agent / A2A / MCP / assistant tools may stamp on create.
#: ICS imports use the import pipeline (not tool writes) — exclude ``ics``.
TOOL_WRITE_USER_EVENT_ORIGINS: Final[frozenset[str]] = frozenset(
    {
        ORIGIN_MANUAL,
        ORIGIN_ASSISTANT,
        ORIGIN_A2A,
        ORIGIN_AGENT,
        ORIGIN_MCP,
    }
)

USER_EVENT_ORIGIN_CHECK_SQL = "CHECK (origin IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_USER_EVENT_ORIGINS)
)

USER_EVENT_ORIGIN_ERROR = (
    "origin must be 'manual', 'assistant', 'a2a', 'agent', 'ics', or 'mcp'"
)

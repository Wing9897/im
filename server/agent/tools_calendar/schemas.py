"""LLM-facing JSON schemas for the calendar tools (read + write combined).

Wording here is prompt engineering: it is what steers the model toward
``calendar.upcoming`` instead of hand-rolled UTC windows, so edit it with the
same care as ``server/prompts``.

Split sources: :mod:`.schemas_read` / :mod:`.schemas_write`.
"""

from __future__ import annotations

from typing import Any

from server.agent.tools_calendar.schemas_read import READ_TOOL_SCHEMAS
from server.agent.tools_calendar.schemas_write import WRITE_TOOL_SCHEMAS

TOOL_SCHEMAS: list[dict[str, Any]] = [*READ_TOOL_SCHEMAS, *WRITE_TOOL_SCHEMAS]

__all__ = ["TOOL_SCHEMAS"]

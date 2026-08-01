"""LLM-facing JSON schemas for items tools."""

from __future__ import annotations

from typing import Any

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "items.list_expiring",
        "description": (
            "List trackable items that are overdue or expiring within the given days. "
            "ALWAYS use this when the user asks about expiry / 到期 / 過期 / 即將到期 — "
            "do NOT invent item expiry dates from memory. "
            "Archived items are excluded; overdue active items are included by default. "
            "Returns core fields plus attributes summary."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 3650,
                    "description": "Look-ahead days from today (default 30). 0 = overdue / today only.",
                },
                "worksetId": {
                    "type": "string",
                    "description": "Optional ownership workset filter (default: all worksets).",
                },
                "includeOverdue": {
                    "type": "boolean",
                    "description": "Include items already past expiresAt (default true).",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "description": "Max rows (default 50).",
                },
                "search": {
                    "type": "string",
                    "description": "Optional title/notes/attributes keyword filter.",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "items.create",
        "description": (
            "Create a trackable item (inventory / document / food / card, etc.). "
            "worksetId defaults to builtin「一般」(__user__) when omitted. "
            "Dates are local calendar DATE (YYYY-MM-DD), not timed UTC instants. "
            "attributes are optional soft key/value extensions; changing category later "
            "does not strip them. Confirm title and key dates with the user before writing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "minLength": 1},
                "worksetId": {
                    "type": "string",
                    "description": "Ownership workset; omit or __user__ for「一般」.",
                },
                "categoryId": {"type": "string"},
                "purchasedAt": {
                    "type": "string",
                    "description": "Purchase DATE YYYY-MM-DD",
                },
                "expiresAt": {
                    "type": "string",
                    "description": "Expiry DATE YYYY-MM-DD",
                },
                "remindBeforeDays": {"type": "integer", "minimum": 0, "maximum": 3650},
                "notes": {"type": "string"},
                "attributes": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                    "description": "Soft extension key/values (string values only).",
                },
            },
            "required": ["title"],
            "additionalProperties": False,
        },
    },
]

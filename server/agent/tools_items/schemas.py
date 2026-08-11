"""LLM-facing JSON schemas for items tools."""

from __future__ import annotations

from typing import Any

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "items.list",
        "description": (
            "List trackable items with optional filters (workset, category, status, keyword). "
            "Use for inventory lookup — not for expiry questions (use items.list_expiring). "
            "Returns core fields plus quantity/unit and notes. "
            "Money is on purchase_effective linked calendars (amount/direction), not the item."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "worksetId": {
                    "type": "string",
                    "description": "Optional ownership workset filter (default: all worksets).",
                },
                "categoryId": {
                    "type": "string",
                    "description": "Optional category filter; empty string = uncategorized only.",
                },
                "status": {
                    "type": "string",
                    "enum": ["active", "archived"],
                    "description": "Optional status filter (default: all statuses).",
                },
                "search": {
                    "type": "string",
                    "description": "Optional title/notes/quantity/unit keyword filter.",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "description": "Max rows (default 50).",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "items.list_expiring",
        "description": (
            "List trackable items that are overdue or expiring within the given days. "
            "ALWAYS use this when the user asks about expiry / 到期 / 過期 / 即將到期 — "
            "do NOT invent item expiry dates from memory. "
            "Archived items are excluded; overdue active items are included by default. "
            "Returns core fields plus notes summary."
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
                    "description": "Optional title/notes keyword filter.",
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
            "Purchase / expiry dates are not set here — create linked calendar "
            "milestones via the Items form (kind=expires / purchase_effective). "
            "calendar.create_event only creates kind=normal events (no finance / expiry). "
            "Free-form details go in notes. Confirm title with the user before writing."
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
                "notes": {"type": "string"},
                "quantity": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Optional inventory count (supports decimals, e.g. 1.5).",
                },
                "unit": {
                    "type": "string",
                    "description": "Optional unit label (e.g. 個, 盒, kg, ml).",
                },
            },
            "required": ["title"],
            "additionalProperties": False,
        },
    },
    {
        "name": "items.update",
        "description": (
            "Update a trackable item (title, workset, category, notes, status, quantity, unit). "
            "Purchase/expiry dates and money are NOT set here — use linked calendar "
            "milestones via calendar tools. Confirm changes with the user before writing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Item id to update."},
                "title": {"type": "string", "minLength": 1},
                "worksetId": {"type": "string"},
                "categoryId": {"type": "string", "description": "Category id; null to clear."},
                "notes": {"type": "string"},
                "status": {"type": "string", "enum": ["active", "archived"]},
                "quantity": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Inventory count (supports decimals).",
                },
                "unit": {"type": "string", "description": "Unit label (e.g. 個, 盒, kg)."},
            },
            "required": ["id"],
            "additionalProperties": False,
        },
    },
]

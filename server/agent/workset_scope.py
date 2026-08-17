"""Apply household MCP/A2A workset visibility onto workset-keyed tools.

Calendar 我的日程 (user events) is household-scoped and is not filtered here.
Allowed ids come from ``worksets.external_enabled=1``; empty = fail closed.
"""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.domain.mcp_workset_scope import (
    ALLOWED_WORKSET_IDS_ARG,
    WORKSET_NOT_ALLOWED_ERROR,
)
from server.queries.items_queries import fetch_item_row
from server.worksets_const import SYSTEM_WORKSET_ID

WORKSET_SCOPED_TOOL_NAMES = frozenset(
    {
        "intelligence.search_events",
        "messages.search",
        "items.list",
        "items.list_expiring",
        "items.create",
        "items.update",
    }
)


def _requested_workset_id(args: dict[str, Any]) -> str | None:
    raw = args.get("worksetId")
    if raw is None:
        raw = args.get("workset_id")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _create_target_workset_id(args: dict[str, Any]) -> str:
    requested = _requested_workset_id(args)
    if requested is not None:
        return requested
    default = args.get("_default_workset_id")
    if isinstance(default, str) and default.strip():
        return default.strip()
    return SYSTEM_WORKSET_ID


def _inject_allowed(args: dict[str, Any], allowed: frozenset[str]) -> None:
    args[ALLOWED_WORKSET_IDS_ARG] = list(allowed)


async def apply_household_workset_scope(
    db: Database,
    name: str,
    args: dict[str, Any],
    allowed: frozenset[str],
) -> dict[str, Any] | None:
    """Mutate ``args`` for the enabled-workset set. Return an error dict to block."""
    if name not in WORKSET_SCOPED_TOOL_NAMES:
        return None

    if name in {"items.list", "items.list_expiring", "intelligence.search_events", "messages.search"}:
        requested = _requested_workset_id(args)
        if requested is not None and requested not in allowed:
            _inject_allowed(args, frozenset())
            return None
        _inject_allowed(args, allowed)
        return None

    if name == "items.create":
        if _create_target_workset_id(args) not in allowed:
            return {"error": WORKSET_NOT_ALLOWED_ERROR}
        return None

    if name == "items.update":
        item_id = args.get("id") or args.get("itemId") or args.get("item_id")
        if not isinstance(item_id, str) or not item_id.strip():
            return None
        existing = await fetch_item_row(db, item_id.strip())
        if existing is None:
            return {"error": "item not found"}
        existing_wid = str(existing.get("workset_id") or SYSTEM_WORKSET_ID).strip() or SYSTEM_WORKSET_ID
        if existing_wid not in allowed:
            return {"error": "item not found"}
        patch_wid = _requested_workset_id(args)
        if patch_wid is not None and patch_wid not in allowed:
            return {"error": WORKSET_NOT_ALLOWED_ERROR}
        return None

    return None

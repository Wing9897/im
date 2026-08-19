"""MCP/A2A workset visibility helpers — single public import surface.

Allowed ids are worksets with ``external_enabled=1`` (see
``fetch_external_enabled_workset_ids``). Empty set = fail closed.
Calendar 我的日程 and in-app assistant are not gated here.

Binder / SQL, tool-name allowlist, and ``apply_household_workset_scope`` all
live here. Callers import this module only — do not re-export from
``server.agent``.
"""

from __future__ import annotations

from typing import Any, Final

from server.db.database import Database
from server.worksets_const import SYSTEM_WORKSET_ID

#: Injected into tool args (handlers / queries).
ALLOWED_WORKSET_IDS_ARG: Final = "_allowed_workset_ids"

WORKSET_NOT_ALLOWED_ERROR: Final = "workset not allowed"

WORKSET_SCOPED_TOOL_NAMES: Final = frozenset(
    {
        "intelligence.search_events",
        "messages.search",
        "items.list",
        "items.list_expiring",
        "items.create",
        "items.update",
        "worksets.list",
    }
)


def bind_workset_ids_sql(column: str, workset_ids: list[str] | None) -> tuple[str | None, list[str]]:
    """``None`` → no clause. Empty list → ``1=0``. Else ``column IN (...)``."""
    if workset_ids is None:
        return None, []
    if not workset_ids:
        return "1=0", []
    placeholders = ", ".join("?" for _ in workset_ids)
    return f"{column} IN ({placeholders})", list(workset_ids)


def allowed_workset_ids_from_args(arguments: dict[str, Any]) -> list[str] | None:
    if ALLOWED_WORKSET_IDS_ARG not in arguments:
        return None
    raw = arguments.get(ALLOWED_WORKSET_IDS_ARG)
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if isinstance(item, str) and str(item).strip()]


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

    if name in {
        "items.list",
        "items.list_expiring",
        "intelligence.search_events",
        "messages.search",
        "worksets.list",
    }:
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
        from server.queries.items_queries import fetch_item_row

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


__all__ = [
    "ALLOWED_WORKSET_IDS_ARG",
    "WORKSET_NOT_ALLOWED_ERROR",
    "WORKSET_SCOPED_TOOL_NAMES",
    "allowed_workset_ids_from_args",
    "apply_household_workset_scope",
    "bind_workset_ids_sql",
]

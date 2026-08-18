"""Handlers for items.* agent tools."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from server.db.database import Database
from server.domain.workset_scope import allowed_workset_ids_from_args
from server.items.normalize import _UNSET, ItemValidationError
from server.items.service import create_item, patch_item
from server.queries.items_queries import fetch_expiring_items, fetch_item_row, fetch_item_rows
from server.wire.serializers import serialize_item
from server.worksets_const import SYSTEM_WORKSET_ID


def _today_local() -> date:
    return date.today()


def _compact_item_summary(item: dict[str, Any], *, today: date | None = None) -> dict[str, Any]:
    expires = item.get("expiresAt")
    overdue = False
    if today is not None and expires:
        overdue = bool(str(expires) < today.isoformat())
    return {
        "id": item["id"],
        "title": item["title"],
        "worksetId": item.get("worksetId") or SYSTEM_WORKSET_ID,
        "categoryId": item.get("categoryId"),
        "expiresAt": expires,
        "remindBeforeDays": item.get("remindBeforeDays"),
        "status": item.get("status") or "active",
        "overdue": overdue,
        "quantity": item.get("quantity"),
        "unit": item.get("unit"),
        "notes": item.get("notes") or "",
    }


async def _tool_list(db: Database, arguments: dict[str, Any]) -> dict[str, Any]:
    workset_id = arguments.get("worksetId") or arguments.get("workset_id")
    workset_id = workset_id.strip() or None if isinstance(workset_id, str) else None
    category_id = arguments.get("categoryId") or arguments.get("category_id")
    if isinstance(category_id, str):
        category_id = category_id.strip()
        if category_id == "":
            category_id = ""
        elif not category_id:
            category_id = None
    else:
        category_id = None
    status = arguments.get("status")
    status = status.strip().lower() or None if isinstance(status, str) else None
    if status is not None and status not in {"active", "archived"}:
        return {"error": "status must be active or archived"}
    search = arguments.get("search")
    search_needle = str(search).strip() if search else ""
    limit_raw = arguments.get("limit", 50)
    try:
        limit = max(1, min(int(limit_raw), 100))
    except (TypeError, ValueError):
        return {"error": "limit must be an integer"}

    rows = await fetch_item_rows(
        db,
        workset_id=workset_id,
        category_id=category_id,
        status=status,
        search=search_needle or None,
        workset_ids=allowed_workset_ids_from_args(arguments),
    )
    items = [_compact_item_summary(serialize_item(row)) for row in rows[:limit]]
    return {"items": items, "count": len(items)}


async def _tool_list_expiring(db: Database, arguments: dict[str, Any]) -> dict[str, Any]:
    days_raw = arguments.get("days", 30)
    try:
        days = int(days_raw)
    except (TypeError, ValueError):
        return {"error": "days must be an integer"}
    days = max(0, min(days, 3650))
    include_overdue = arguments.get("includeOverdue", True)
    if not isinstance(include_overdue, bool):
        include_overdue = str(include_overdue).strip().lower() not in {"0", "false", "no"}
    limit_raw = arguments.get("limit", 50)
    try:
        limit = max(1, min(int(limit_raw), 100))
    except (TypeError, ValueError):
        return {"error": "limit must be an integer"}
    workset_id = arguments.get("worksetId") or arguments.get("workset_id")
    workset_id = workset_id.strip() or None if isinstance(workset_id, str) else None
    search = arguments.get("search")
    search_needle = str(search).strip().lower() if search else ""

    today = _today_local()
    until = today + timedelta(days=days)
    # Derive-on-read: expiresAt comes from the primary linked kind=expires event.
    rows = await fetch_expiring_items(
        db,
        today=today.isoformat(),
        until=until.isoformat(),
        workset_id=workset_id,
        include_overdue=include_overdue,
        limit=limit * 2 if search_needle else limit,
        workset_ids=allowed_workset_ids_from_args(arguments),
    )
    items = [serialize_item(row) for row in rows]
    if search_needle:
        filtered = []
        for item in items:
            hay = f"{item.get('title') or ''} {item.get('notes') or ''}".lower()
            if search_needle in hay:
                filtered.append(item)
            if len(filtered) >= limit:
                break
        items = filtered
    else:
        items = items[:limit]

    summaries = [_compact_item_summary(item, today=today) for item in items]
    return {
        "items": summaries,
        "today": today.isoformat(),
        "until": until.isoformat(),
        "count": len(summaries),
    }


async def _tool_create(db: Database, arguments: dict[str, Any]) -> dict[str, Any]:
    title = arguments.get("title")
    if not isinstance(title, str) or not title.strip():
        return {"error": "title is required"}
    workset_id = arguments.get("worksetId") or arguments.get("workset_id")
    if workset_id is None:
        workset_id = arguments.get("_default_workset_id") or SYSTEM_WORKSET_ID
    try:
        item = await create_item(
            db,
            title=title,
            workset_id=workset_id,
            category_id=arguments.get("categoryId") or arguments.get("category_id"),
            notes=arguments.get("notes") or "",
            status="active",
            quantity=arguments.get("quantity"),
            unit=arguments.get("unit"),
        )
    except ItemValidationError as exc:
        return {"error": str(exc)}
    return {"item": item, "created": True}


async def _tool_update(db: Database, arguments: dict[str, Any]) -> dict[str, Any]:
    item_id = arguments.get("id") or arguments.get("itemId") or arguments.get("item_id")
    if not isinstance(item_id, str) or not item_id.strip():
        return {"error": "id is required"}
    item_id = item_id.strip()
    existing = await fetch_item_row(db, item_id)
    if existing is None:
        return {"error": "item not found"}

    patch_kwargs: dict[str, Any] = {}
    field_aliases = (
        ("title", ("title",)),
        ("worksetId", ("worksetId", "workset_id")),
        ("categoryId", ("categoryId", "category_id")),
        ("notes", ("notes",)),
        ("status", ("status",)),
        ("quantity", ("quantity",)),
        ("unit", ("unit",)),
    )
    for wire_key, arg_keys in field_aliases:
        for arg_key in arg_keys:
            if arg_key in arguments:
                patch_kwargs[wire_key] = arguments[arg_key]
                break
    if not patch_kwargs:
        return {"error": "no updatable fields provided"}

    try:
        item = await patch_item(
            db,
            item_id,
            title=patch_kwargs.get("title", _UNSET),
            workset_id=patch_kwargs.get("worksetId", _UNSET),
            category_id=patch_kwargs.get("categoryId", _UNSET),
            notes=patch_kwargs.get("notes", _UNSET),
            status=patch_kwargs.get("status", _UNSET),
            quantity=patch_kwargs.get("quantity", _UNSET),
            unit=patch_kwargs.get("unit", _UNSET),
        )
    except ItemValidationError as exc:
        return {"error": str(exc)}
    return {"item": item, "updated": True}

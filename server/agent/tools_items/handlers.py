"""Handlers for items.* agent tools."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from server.db.database import Database
from server.items.normalize import ItemValidationError
from server.items.service import create_item
from server.queries.items_queries import fetch_expiring_items
from server.wire.serializers import serialize_item
from server.worksets_const import SYSTEM_WORKSET_ID


def _today_local() -> date:
    return date.today()


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
    if isinstance(workset_id, str):
        workset_id = workset_id.strip() or None
    else:
        workset_id = None
    search = arguments.get("search")
    search_needle = str(search).strip().lower() if search else ""

    today = _today_local()
    until = today + timedelta(days=days)
    rows = await fetch_expiring_items(
        db,
        today=today.isoformat(),
        until=until.isoformat(),
        workset_id=workset_id,
        include_overdue=include_overdue,
        limit=limit * 2 if search_needle else limit,
    )
    items = [serialize_item(row) for row in rows]
    if search_needle:
        filtered = []
        for item in items:
            hay = f"{item.get('title') or ''} {item.get('notes') or ''} {item.get('attributes') or ''}".lower()
            if search_needle in hay:
                filtered.append(item)
            if len(filtered) >= limit:
                break
        items = filtered
    else:
        items = items[:limit]

    # Compact summary for the model: core + attributes.
    summaries = []
    for item in items:
        expires = item.get("expiresAt")
        overdue = bool(expires and str(expires) < today.isoformat())
        summaries.append(
            {
                "id": item["id"],
                "title": item["title"],
                "worksetId": item.get("worksetId") or SYSTEM_WORKSET_ID,
                "categoryId": item.get("categoryId"),
                "purchasedAt": item.get("purchasedAt"),
                "expiresAt": expires,
                "remindBeforeDays": item.get("remindBeforeDays"),
                "overdue": overdue,
                "attributes": item.get("attributes") or {},
                "notes": item.get("notes") or "",
            }
        )
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
            purchased_at=arguments.get("purchasedAt") or arguments.get("purchased_at"),
            expires_at=arguments.get("expiresAt") or arguments.get("expires_at"),
            remind_before_days=arguments.get("remindBeforeDays")
            if "remindBeforeDays" in arguments
            else arguments.get("remind_before_days"),
            notes=arguments.get("notes") or "",
            status="active",
            attributes=arguments.get("attributes"),
        )
    except ItemValidationError as exc:
        return {"error": str(exc)}
    return {"item": item, "created": True}

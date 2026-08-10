"""Item and item-category wire serializers."""

from __future__ import annotations

from typing import Any, Mapping

from server.worksets_const import SYSTEM_WORKSET_ID


def serialize_item_category(row: Mapping[str, Any]) -> dict[str, Any]:
    from server.items.normalize import parse_field_schema_json

    remind = row.get("default_remind_before_days")
    raw_emoji = row.get("emoji")
    emoji = str(raw_emoji).strip() if isinstance(raw_emoji, str) and raw_emoji.strip() else None
    return {
        "id": str(row["id"]),
        "name": str(row.get("name") or ""),
        "slug": row.get("slug") or None,
        "sortOrder": int(row.get("sort_order") or 0),
        "color": row.get("color") or None,
        "emoji": emoji,
        "fieldSchema": parse_field_schema_json(row.get("field_schema")),
        "defaultRemindBeforeDays": int(remind) if remind is not None else None,
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def serialize_item(row: Mapping[str, Any]) -> dict[str, Any]:
    from server.items.normalize import parse_attributes_json

    remind = row.get("remind_before_days")
    raw_workset = row.get("workset_id")
    workset_id = str(raw_workset).strip() if isinstance(raw_workset, str) and raw_workset.strip() else SYSTEM_WORKSET_ID
    raw_category = row.get("category_id")
    category_id = str(raw_category).strip() if isinstance(raw_category, str) and raw_category.strip() else None
    raw_emoji = row.get("emoji")
    emoji = str(raw_emoji).strip() if isinstance(raw_emoji, str) and raw_emoji.strip() else None
    raw_quantity = row.get("quantity")
    quantity = float(raw_quantity) if raw_quantity is not None else None
    raw_unit = row.get("unit")
    unit = str(raw_unit).strip() if isinstance(raw_unit, str) and raw_unit.strip() else None
    return {
        "id": str(row["id"]),
        "title": str(row.get("title") or ""),
        "categoryId": category_id,
        "worksetId": workset_id,
        "expiresAt": row.get("expires_at") or None,
        "remindBeforeDays": int(remind) if remind is not None else None,
        "notes": str(row.get("notes") or ""),
        "status": str(row.get("status") or "active"),
        "emoji": emoji,
        "quantity": quantity,
        "unit": unit,
        "attributes": parse_attributes_json(row.get("attributes_json")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }

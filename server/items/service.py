"""CRUD service for item categories and items."""

from __future__ import annotations

from typing import Any

from server.db.database import Database, TransactionDb
from server.items.normalize import (
    _UNSET,
    ItemValidationError,
    attributes_to_json,
    field_schema_to_json,
    normalize_attributes,
    normalize_category_id_wire,
    normalize_color,
    normalize_emoji,
    normalize_field_schema,
    normalize_notes,
    normalize_remind_before_days,
    normalize_slug,
    normalize_sort_order,
    normalize_status,
    normalize_workset_id_wire,
    parse_date_or_none,
    preserve_attributes_json,
    require_category_name,
    require_title,
)
from server.queries.items_queries import (
    delete_category,
    delete_item,
    fetch_category_by_slug,
    fetch_category_row,
    fetch_item_row,
    insert_category,
    insert_item,
    update_category,
    update_item,
)
from server.queries.worksets_queries import workset_exists
from server.util import new_id, utc_now_iso
from server.wire.serializers import serialize_item, serialize_item_category


async def _require_workset(db: Database, workset_id: str) -> str:
    if not await workset_exists(db, workset_id):
        raise ItemValidationError("worksetId not found")
    return workset_id


async def _resolve_category_id(db: Database, category_id: str | None) -> str | None:
    if category_id is None:
        return None
    row = await fetch_category_row(db, category_id)
    if row is None:
        raise ItemValidationError("categoryId not found")
    return category_id


async def create_category(
    db: Database,
    *,
    name: str,
    slug: str | None = None,
    sort_order: int | None = 0,
    color: str | None = None,
    emoji: str | None = None,
    field_schema: Any = None,
    default_remind_before_days: int | None = None,
) -> dict[str, Any]:
    clean_name = require_category_name(name)
    clean_slug = normalize_slug(slug)
    clean_sort = normalize_sort_order(sort_order)
    clean_color = normalize_color(color)
    clean_emoji = normalize_emoji(emoji)
    clean_schema = normalize_field_schema(field_schema)
    clean_remind = normalize_remind_before_days(default_remind_before_days)
    if clean_slug is not None:
        existing = await fetch_category_by_slug(db, clean_slug)
        if existing is not None:
            raise ItemValidationError("slug already exists")
    category_id = new_id()
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_category(
            TransactionDb(conn),
            category_id=category_id,
            name=clean_name,
            slug=clean_slug,
            sort_order=clean_sort,
            color=clean_color,
            emoji=clean_emoji,
            field_schema=field_schema_to_json(clean_schema),
            default_remind_before_days=clean_remind,
            now=now,
        )
    row = await fetch_category_row(db, category_id)
    assert row is not None
    return serialize_item_category(row)


async def patch_category(
    db: Database,
    category_id: str,
    *,
    name: Any = _UNSET,
    slug: Any = _UNSET,
    sort_order: Any = _UNSET,
    color: Any = _UNSET,
    emoji: Any = _UNSET,
    field_schema: Any = _UNSET,
    default_remind_before_days: Any = _UNSET,
) -> dict[str, Any]:
    existing = await fetch_category_row(db, category_id)
    if existing is None:
        raise ItemValidationError("category not found")
    next_name = require_category_name(name) if name is not _UNSET else str(existing["name"])
    if slug is _UNSET:
        next_slug = existing.get("slug")
    else:
        next_slug = normalize_slug(slug)
    next_sort = (
        normalize_sort_order(sort_order)
        if sort_order is not _UNSET
        else int(existing.get("sort_order") or 0)
    )
    next_color = normalize_color(color) if color is not _UNSET else existing.get("color")
    if emoji is _UNSET:
        next_emoji = existing.get("emoji")
        if next_emoji is not None:
            next_emoji = str(next_emoji) if next_emoji else None
    else:
        next_emoji = normalize_emoji(emoji)
    if field_schema is _UNSET:
        next_schema_json = str(existing.get("field_schema") or "[]")
        next_schema = normalize_field_schema(next_schema_json)
    else:
        next_schema = normalize_field_schema(field_schema)
        next_schema_json = field_schema_to_json(next_schema)
    if default_remind_before_days is _UNSET:
        next_remind = existing.get("default_remind_before_days")
        if next_remind is not None:
            next_remind = int(next_remind)
    else:
        next_remind = normalize_remind_before_days(default_remind_before_days)
    if next_slug:
        clash = await fetch_category_by_slug(db, str(next_slug))
        if clash is not None and str(clash["id"]) != category_id:
            raise ItemValidationError("slug already exists")
    now = utc_now_iso()
    async with db.transaction() as conn:
        await update_category(
            TransactionDb(conn),
            category_id=category_id,
            name=next_name,
            slug=str(next_slug) if next_slug else None,
            sort_order=next_sort,
            color=str(next_color) if next_color else None,
            emoji=str(next_emoji) if next_emoji else None,
            field_schema=next_schema_json,
            default_remind_before_days=next_remind,
            now=now,
        )
    row = await fetch_category_row(db, category_id)
    assert row is not None
    return serialize_item_category(row)


async def remove_category(db: Database, category_id: str) -> None:
    existing = await fetch_category_row(db, category_id)
    if existing is None:
        raise ItemValidationError("category not found")
    async with db.transaction() as conn:
        await delete_category(TransactionDb(conn), category_id)


async def create_item(
    db: Database,
    *,
    title: str,
    workset_id: Any = None,
    category_id: Any = None,
    purchased_at: Any = None,
    expires_at: Any = None,
    remind_before_days: Any = None,
    notes: Any = "",
    status: Any = "active",
    emoji: Any = None,
    attributes: Any = None,
) -> dict[str, Any]:
    clean_title = require_title(title)
    clean_workset = await _require_workset(db, normalize_workset_id_wire(workset_id))
    clean_category = await _resolve_category_id(db, normalize_category_id_wire(category_id))
    clean_purchased = parse_date_or_none(purchased_at)
    clean_expires = parse_date_or_none(expires_at)
    clean_remind = normalize_remind_before_days(remind_before_days)
    if clean_remind is None and clean_category is not None:
        cat = await fetch_category_row(db, clean_category)
        if cat is not None and cat.get("default_remind_before_days") is not None:
            clean_remind = int(cat["default_remind_before_days"])
    clean_notes = normalize_notes(notes)
    clean_status = normalize_status(status)
    clean_emoji = normalize_emoji(emoji)
    clean_attrs = normalize_attributes(attributes)
    item_id = new_id()
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_item(
            TransactionDb(conn),
            item_id=item_id,
            title=clean_title,
            category_id=clean_category,
            workset_id=clean_workset,
            purchased_at=clean_purchased,
            expires_at=clean_expires,
            remind_before_days=clean_remind,
            notes=clean_notes,
            status=clean_status,
            emoji=clean_emoji,
            attributes_json=attributes_to_json(clean_attrs),
            now=now,
        )
    row = await fetch_item_row(db, item_id)
    assert row is not None
    return serialize_item(row)


async def patch_item(
    db: Database,
    item_id: str,
    *,
    title: Any = _UNSET,
    workset_id: Any = _UNSET,
    category_id: Any = _UNSET,
    purchased_at: Any = _UNSET,
    expires_at: Any = _UNSET,
    remind_before_days: Any = _UNSET,
    notes: Any = _UNSET,
    status: Any = _UNSET,
    emoji: Any = _UNSET,
    attributes: Any = _UNSET,
) -> dict[str, Any]:
    existing = await fetch_item_row(db, item_id)
    if existing is None:
        raise ItemValidationError("item not found")

    next_title = require_title(title) if title is not _UNSET else str(existing["title"])
    if workset_id is _UNSET:
        next_workset = str(existing["workset_id"])
    else:
        next_workset = await _require_workset(db, normalize_workset_id_wire(workset_id))
    prev_category = existing.get("category_id")
    prev_category = str(prev_category) if prev_category else None
    if category_id is _UNSET:
        next_category = prev_category
        category_changed = False
    else:
        # Changing category must NOT strip attributes (soft template).
        next_category = await _resolve_category_id(db, normalize_category_id_wire(category_id))
        category_changed = next_category != prev_category
    next_purchased = (
        parse_date_or_none(purchased_at) if purchased_at is not _UNSET else existing.get("purchased_at")
    )
    next_expires = parse_date_or_none(expires_at) if expires_at is not _UNSET else existing.get("expires_at")
    if remind_before_days is _UNSET:
        next_remind = existing.get("remind_before_days")
        if next_remind is not None:
            next_remind = int(next_remind)
    else:
        next_remind = normalize_remind_before_days(remind_before_days)
    # Align with FE resolveRemindOnCategoryChange: only soft-fill when remind is empty.
    if category_changed and next_remind is None and next_category is not None:
        cat = await fetch_category_row(db, next_category)
        if cat is not None and cat.get("default_remind_before_days") is not None:
            next_remind = int(cat["default_remind_before_days"])
    next_notes = normalize_notes(notes) if notes is not _UNSET else str(existing.get("notes") or "")
    next_status = normalize_status(status) if status is not _UNSET else str(existing.get("status") or "active")
    if emoji is _UNSET:
        next_emoji = existing.get("emoji")
        if next_emoji is not None:
            next_emoji = str(next_emoji) if next_emoji else None
    else:
        next_emoji = normalize_emoji(emoji)
    if attributes is _UNSET:
        # Do not re-parse/re-serialize: dirty nested rows must not amplify on unrelated PATCH.
        next_attrs_json = preserve_attributes_json(existing.get("attributes_json"))
    else:
        next_attrs_json = attributes_to_json(normalize_attributes(attributes))

    now = utc_now_iso()
    async with db.transaction() as conn:
        await update_item(
            TransactionDb(conn),
            item_id=item_id,
            title=next_title,
            category_id=next_category,
            workset_id=next_workset,
            purchased_at=next_purchased if isinstance(next_purchased, str) or next_purchased is None else str(next_purchased),
            expires_at=next_expires if isinstance(next_expires, str) or next_expires is None else str(next_expires),
            remind_before_days=next_remind,
            notes=next_notes,
            status=next_status,
            emoji=str(next_emoji) if next_emoji else None,
            attributes_json=next_attrs_json,
            now=now,
        )
    row = await fetch_item_row(db, item_id)
    assert row is not None
    return serialize_item(row)


async def remove_item(db: Database, item_id: str) -> None:
    existing = await fetch_item_row(db, item_id)
    if existing is None:
        raise ItemValidationError("item not found")
    async with db.transaction() as conn:
        await delete_item(TransactionDb(conn), item_id)

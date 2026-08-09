"""Items + item categories CRUD under ``/api/v1/items``."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request

from server.api.deps import API_DEPS, get_db, publish_resource_modified
from server.api.schemas.requests import (
    CategoryCreateBody,
    CategoryUpdateBody,
    ItemCreateBody,
    ItemUpdateBody,
)
from server.api.schemas.responses.items import (
    ItemCategoryDeleteResponse,
    ItemCategoryResponse,
    ItemDeleteResponse,
    ItemResponse,
)
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.items.normalize import ItemValidationError
from server.items.service import (
    create_category,
    create_item,
    patch_category,
    patch_item,
    remove_category,
    remove_item,
)
from server.queries.items_queries import (
    fetch_all_category_rows,
    fetch_category_row,
    fetch_item_row,
    fetch_item_rows,
)
from server.wire.serializers import serialize_item, serialize_item_category

router = APIRouter(prefix="/api/v1/items", tags=["items"], dependencies=API_DEPS)


def _notify_item(request: Request, item_id: str, action: str) -> None:
    publish_resource_modified(request, "item", item_id, action)


def _notify_category(request: Request, category_id: str, action: str) -> None:
    publish_resource_modified(request, "item_category", category_id, action)


def _map_validation(exc: ItemValidationError) -> None:
    message = str(exc)
    if "not found" in message.lower():
        raise http_error(404, message, error_code=NOT_FOUND) from exc
    raise http_error(422, message, error_code=VALIDATION_ERROR) from exc


# --- Categories (mounted before /{item_id}) ---


@router.get("/categories", response_model=list[ItemCategoryResponse])
async def list_categories(request: Request) -> list[dict[str, Any]]:
    rows = await fetch_all_category_rows(get_db(request))
    return [serialize_item_category(row) for row in rows]


@router.post("/categories", status_code=201, response_model=ItemCategoryResponse)
async def post_category(request: Request, body: CategoryCreateBody) -> dict[str, Any]:
    try:
        result = await create_category(
            get_db(request),
            name=body.name,
            slug=body.slug,
            sort_order=body.sortOrder,
            color=body.color,
            emoji=body.emoji,
            field_schema=body.fieldSchema,
            default_remind_before_days=body.defaultRemindBeforeDays,
        )
    except ItemValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify_category(request, str(result["id"]), "created")
    return result


@router.get("/categories/{category_id}", response_model=ItemCategoryResponse)
async def get_category(request: Request, category_id: str) -> dict[str, Any]:
    row = await fetch_category_row(get_db(request), category_id)
    if row is None:
        raise http_error(404, "category not found", error_code=NOT_FOUND)
    return serialize_item_category(row)


@router.patch("/categories/{category_id}", response_model=ItemCategoryResponse)
async def patch_category_route(request: Request, category_id: str, body: CategoryUpdateBody) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    kwargs: dict[str, Any] = {}
    mapping = {
        "name": "name",
        "slug": "slug",
        "sortOrder": "sort_order",
        "color": "color",
        "emoji": "emoji",
        "fieldSchema": "field_schema",
        "defaultRemindBeforeDays": "default_remind_before_days",
    }
    for wire, arg in mapping.items():
        if wire in fields:
            kwargs[arg] = fields[wire]
    try:
        result = await patch_category(get_db(request), category_id, **kwargs)
    except ItemValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify_category(request, category_id, "updated")
    return result


@router.delete("/categories/{category_id}", response_model=ItemCategoryDeleteResponse)
async def delete_category_route(request: Request, category_id: str) -> dict[str, bool]:
    try:
        await remove_category(get_db(request), category_id)
    except ItemValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify_category(request, category_id, "deleted")
    return {"ok": True}


# --- Items ---


@router.get("", response_model=list[ItemResponse])
async def list_items(
    request: Request,
    workset_id: str | None = Query(default=None, alias="worksetId"),
    category_id: str | None = Query(default=None, alias="categoryId"),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    """List items; date cache columns are read-only (SoT = linked calendars)."""
    rows = await fetch_item_rows(
        get_db(request),
        workset_id=workset_id,
        category_id=category_id,
        status=status,
        search=search,
    )
    return [serialize_item(row) for row in rows]


@router.post("", status_code=201, response_model=ItemResponse)
async def post_item(request: Request, body: ItemCreateBody) -> dict[str, Any]:
    try:
        result = await create_item(
            get_db(request),
            title=body.title,
            workset_id=body.worksetId,
            category_id=body.categoryId,
            notes=body.notes,
            status=body.status,
            emoji=body.emoji,
            quantity=body.quantity,
            unit=body.unit,
            price=body.price,
            attributes=body.attributes,
        )
    except ItemValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify_item(request, str(result["id"]), "created")
    return result


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(request: Request, item_id: str) -> dict[str, Any]:
    row = await fetch_item_row(get_db(request), item_id)
    if row is None:
        raise http_error(404, "item not found", error_code=NOT_FOUND)
    return serialize_item(row)


@router.patch("/{item_id}", response_model=ItemResponse)
async def patch_item_route(request: Request, item_id: str, body: ItemUpdateBody) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    mapping = {
        "title": "title",
        "worksetId": "workset_id",
        "categoryId": "category_id",
        "notes": "notes",
        "status": "status",
        "emoji": "emoji",
        "quantity": "quantity",
        "unit": "unit",
        "price": "price",
        "attributes": "attributes",
    }
    kwargs = {mapping[wire]: value for wire, value in fields.items() if wire in mapping}
    try:
        result = await patch_item(get_db(request), item_id, **kwargs)
    except ItemValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify_item(request, item_id, "updated")
    return result


@router.delete("/{item_id}", response_model=ItemDeleteResponse)
async def delete_item_route(request: Request, item_id: str) -> dict[str, bool]:
    try:
        await remove_item(get_db(request), item_id)
    except ItemValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify_item(request, item_id, "deleted")
    return {"ok": True}

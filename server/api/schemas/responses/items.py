"""Item / category CRUD response models."""

from __future__ import annotations

from pydantic import BaseModel

from server.domain.item_statuses import ITEM_STATUS_ACTIVE, ItemStatus


class ItemCategoryResponse(BaseModel):
    id: str
    name: str
    slug: str | None = None
    sortOrder: int = 0
    color: str | None = None
    emoji: str | None = None
    defaultRemindBeforeDays: int | None = None
    createdAt: str | None = None
    updatedAt: str | None = None


class ItemResponse(BaseModel):
    id: str
    title: str
    categoryId: str | None = None
    worksetId: str
    expiresAt: str | None = None
    remindBeforeDays: int | None = None
    notes: str = ""
    status: ItemStatus = ITEM_STATUS_ACTIVE
    emoji: str | None = None
    quantity: float | None = None
    unit: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None


class ItemDeleteResponse(BaseModel):
    ok: bool = True


class ItemCategoryDeleteResponse(BaseModel):
    ok: bool = True

"""Item / category CRUD response models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ItemFieldSchemaEntry(BaseModel):
    key: str
    label: str


class ItemCategoryResponse(BaseModel):
    id: str
    name: str
    slug: str | None = None
    sortOrder: int = 0
    color: str | None = None
    emoji: str | None = None
    fieldSchema: list[ItemFieldSchemaEntry] = Field(default_factory=list)
    defaultRemindBeforeDays: int | None = None
    createdAt: str | None = None
    updatedAt: str | None = None


class ItemResponse(BaseModel):
    id: str
    title: str
    categoryId: str | None = None
    worksetId: str
    purchasedAt: str | None = None
    expiresAt: str | None = None
    remindBeforeDays: int | None = None
    notes: str = ""
    status: str = "active"
    emoji: str | None = None
    attributes: dict[str, str] = Field(default_factory=dict)
    createdAt: str | None = None
    updatedAt: str | None = None


class ItemDeleteResponse(BaseModel):
    ok: bool = True


class ItemCategoryDeleteResponse(BaseModel):
    ok: bool = True


# Keep Any for OpenAPI additionalProperties flexibility on attributes.
ItemAttributes = dict[str, Any]

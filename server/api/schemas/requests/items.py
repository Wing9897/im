"""Item and item-category request models."""

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    slug: str | None = None
    sortOrder: int | None = 0
    color: str | None = None
    emoji: str | None = None
    fieldSchema: list[dict[str, str]] | None = None
    defaultRemindBeforeDays: int | None = None


class CategoryUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = None
    sortOrder: int | None = None
    color: str | None = None
    emoji: str | None = None
    fieldSchema: list[dict[str, str]] | None = None
    defaultRemindBeforeDays: int | None = None


class ItemCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    worksetId: str | None = None
    categoryId: str | None = None
    purchasedAt: str | None = None
    expiresAt: str | None = None
    remindBeforeDays: int | None = None
    notes: str | None = ""
    status: str | None = "active"
    emoji: str | None = None
    attributes: dict[str, str] | None = None


class ItemUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    worksetId: str | None = None
    categoryId: str | None = None
    purchasedAt: str | None = None
    expiresAt: str | None = None
    remindBeforeDays: int | None = None
    notes: str | None = None
    status: str | None = None
    emoji: str | None = None
    attributes: dict[str, str] | None = None

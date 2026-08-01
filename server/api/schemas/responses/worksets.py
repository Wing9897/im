"""Workset CRUD response models."""

from __future__ import annotations

from pydantic import BaseModel


class WorksetResponse(BaseModel):
    id: str
    name: str
    isSystem: bool = False
    createdAt: str | None = None
    updatedAt: str | None = None


class WorksetDeleteResponse(BaseModel):
    ok: bool = True

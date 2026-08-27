"""Workset CRUD response models."""

from __future__ import annotations

from pydantic import BaseModel


class WorksetResponse(BaseModel):
    id: str
    name: str
    isSystem: bool = False
    #: Workset-level reminder default (builtin 「一般」 can be turned off).
    notifyEnabled: bool = True
    #: MCP/A2A visibility (builtin 「一般」 can be turned off).
    externalEnabled: bool = True
    emoji: str = ""
    description: str = ""
    createdAt: str | None = None
    updatedAt: str | None = None


class WorksetDeleteResponse(BaseModel):
    ok: bool = True

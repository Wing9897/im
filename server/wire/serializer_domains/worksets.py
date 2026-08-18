"""Workset wire serializer."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def serialize_workset(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "isSystem": bool(row.get("is_system")),
        "notifyEnabled": bool(row.get("notify_enabled", 1)),
        "externalEnabled": bool(row.get("external_enabled", 1)),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }

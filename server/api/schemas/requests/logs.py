"""Application-log append request model."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class LogCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: str
    category: str
    kind: str
    message: str | None = None
    messageKey: str | None = None
    messageParams: dict[str, Any] | None = None
    source: str | None = None
    payload: dict[str, Any] | None = None

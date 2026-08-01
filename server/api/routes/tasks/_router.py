"""Shared APIRouter for all task route modules (avoids empty-path include_router)."""

from __future__ import annotations

from fastapi import APIRouter

from server.api.deps import API_DEPS

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"], dependencies=API_DEPS)

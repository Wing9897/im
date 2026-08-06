"""Unified Calendar HTTP surface under ``/api/v1/calendar``."""

from __future__ import annotations

from fastapi import APIRouter

from server.api.deps import API_DEPS
from server.api.routes.calendar import dismissals, importance, imports, items, user_events

router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"], dependencies=API_DEPS)
router.include_router(items.router)
router.include_router(imports.router)
router.include_router(dismissals.router)
router.include_router(importance.router)
router.include_router(user_events.router)

__all__ = ["router"]

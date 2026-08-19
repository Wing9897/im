"""Unified Calendar HTTP surface under ``/api/v1/calendar``."""

from __future__ import annotations

from fastapi import APIRouter

from server.api.deps import API_DEPS
from server.api.routes.calendar import dismissals, holidays, importance, imports, occurrences, recurring, user_events, window

router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"], dependencies=API_DEPS)
router.include_router(window.router)
router.include_router(occurrences.router)
router.include_router(holidays.router)
router.include_router(imports.router)
router.include_router(dismissals.router)
router.include_router(importance.router)
router.include_router(user_events.router)
router.include_router(recurring.router)

__all__ = ["router"]

"""Local FastAPI proxy for IntelligenceCalendar (renderer never talks to it)."""

from __future__ import annotations

from fastapi import APIRouter

from server.api.deps import API_DEPS
from server.api.routes.calendar_share import publish, search, session, subscriptions

router = APIRouter(prefix="/api/v1/calendar-share", tags=["calendar-share"], dependencies=API_DEPS)
router.include_router(session.router)
router.include_router(publish.router)
router.include_router(search.router)
router.include_router(subscriptions.router)

__all__ = ["router"]

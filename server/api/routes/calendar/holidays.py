"""Public holidays overlay for the calendar (Nager.Date, weather region)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from server.api.schemas.responses import CalendarHolidaysResponse
from server.services.holidays import get_holidays

router = APIRouter(tags=["calendar"])


@router.get("/holidays", response_model=CalendarHolidaysResponse)
async def list_calendar_holidays(
    year: int = Query(..., ge=1970, le=2100, description="Gregorian year for Nager.Date."),
    location: str = Query(
        min_length=1,
        max_length=120,
        description="Same weather location string used by GET /api/v1/weather/forecast.",
    ),
) -> CalendarHolidaysResponse:
    return await get_holidays(location, year)

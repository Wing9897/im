"""Thin HTTP boundary for calendar weather forecasts."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from server.api.deps import API_DEPS
from server.api.query_aliases import qalias
from server.api.schemas.responses import WeatherForecastResponse
from server.services.weather import get_forecast, weather_lifespan

router = APIRouter(
    prefix="/api/v1/weather",
    tags=["weather"],
    dependencies=API_DEPS,
    lifespan=weather_lifespan,
)


@router.get("/forecast", response_model=WeatherForecastResponse)
async def forecast(
    location: str = Query(min_length=1, max_length=120),
    start_date: date = qalias("startDate"),
    end_date: date = qalias("endDate"),
    force: bool = Query(
        False,
        description="Bypass the successful forecast TTL cache and refetch providers.",
    ),
) -> WeatherForecastResponse:
    return await get_forecast(location, start_date, end_date, force=force)

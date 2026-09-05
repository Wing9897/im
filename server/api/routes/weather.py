"""Thin HTTP boundary for calendar weather forecasts.

Owns the FastAPI-specific bits (router lifespan, error → HTTP mapping) so
``services/weather.py`` stays framework-free.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date

from fastapi import APIRouter, FastAPI, Query

from server.api.deps import API_DEPS
from server.api.query_aliases import qalias
from server.api.schemas.responses import WeatherForecastResponse
from server.errors import http_error
from server.services.weather import WeatherServiceError, get_forecast, shared_http_session


@asynccontextmanager
async def weather_lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Hold one weather provider connection pool for the app lifetime."""
    async with shared_http_session():
        yield


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
    try:
        return await get_forecast(location, start_date, end_date, force=force)
    except WeatherServiceError as exc:
        raise http_error(exc.status, exc.message, error_code=exc.error_code) from exc

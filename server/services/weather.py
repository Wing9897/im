"""Weather provider orchestration, caching, and HTTP session lifecycle.

Provider clients live in ``weather_providers``; shared HTTP in ``weather_http``.
This module owns cache / failover / public ``get_forecast`` + the shared
session context. It is framework-free: failures surface as
:class:`WeatherServiceError` and ``api/routes/weather.py`` maps them to HTTP.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Any

import aiohttp

from server.api.schemas.responses import WeatherForecastResponse
from server.services import weather_http
from server.services.weather_http import WeatherProviderError
from server.services.weather_providers import (
    _fetch_met_no,
    _fetch_open_meteo_forecast,
    _fetch_wttr,
    _resolve_coordinates,
)

_FORECAST_WALL_TIMEOUT_SECONDS = 25.0
MAX_FORECAST_DAYS = 62
_FORECAST_WINDOW_DAYS = 16
_FORECAST_CACHE_TTL_SECONDS = 15 * 60
_LOGGER = logging.getLogger(__name__)
_FORECAST_CACHE: dict[tuple[str, date, date], tuple[float, dict[str, Any]]] = {}

# Mirrored for tests that monkeypatch ``weather._HTTP_SESSION``.
_HTTP_SESSION: aiohttp.ClientSession | None = None


class WeatherServiceError(Exception):
    """Forecast request failed; carries the HTTP status/code the route should emit."""

    def __init__(self, status: int, message: str, *, error_code: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.error_code = error_code


def _sync_http_session() -> None:
    """Push façade session override into ``weather_http`` (and pull back)."""
    global _HTTP_SESSION
    if _HTTP_SESSION is not None:
        weather_http._HTTP_SESSION = _HTTP_SESSION
    else:
        _HTTP_SESSION = weather_http._HTTP_SESSION


async def _get_json(
    provider: str,
    url: str,
    params: dict[str, str],
    *,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Façade wrapper so session monkeypatches on this module take effect."""
    global _HTTP_SESSION
    _sync_http_session()
    try:
        return await weather_http._get_json(provider, url, params, headers=headers)
    finally:
        _HTTP_SESSION = weather_http._HTTP_SESSION


@asynccontextmanager
async def shared_http_session() -> AsyncIterator[None]:
    """Keep one connection pool for all weather providers while the block runs."""
    global _HTTP_SESSION
    previous_session = weather_http._HTTP_SESSION
    session = aiohttp.ClientSession(timeout=weather_http._REQUEST_TIMEOUT)
    weather_http._HTTP_SESSION = session
    _HTTP_SESSION = session
    try:
        yield
    finally:
        if weather_http._HTTP_SESSION is session:
            weather_http._HTTP_SESSION = previous_session if previous_session and not previous_session.closed else None
            _HTTP_SESSION = weather_http._HTTP_SESSION
        await session.close()


def _today() -> date:
    return date.today()


def _empty_forecast() -> WeatherForecastResponse:
    return WeatherForecastResponse.model_validate(
        {
            "daily": {
                "time": [],
                "weather_code": [],
                "temperature_2m_max": [],
                "temperature_2m_min": [],
            }
        }
    )


def _forecast_intersection(start_date: date, end_date: date) -> tuple[date, date] | None:
    window_start = _today()
    window_end = window_start + timedelta(days=_FORECAST_WINDOW_DAYS - 1)
    clipped_start = max(start_date, window_start)
    clipped_end = min(end_date, window_end)
    return None if clipped_start > clipped_end else (clipped_start, clipped_end)


def _complete_daily_slot(weather_code: Any, temp_max: Any, temp_min: Any) -> bool:
    """Open-Meteo often leaves the last 16-day slot as null; skip those days."""
    return weather_code is not None and temp_max is not None and temp_min is not None


def _clip_daily(daily: dict[str, Any], start_date: date, end_date: date) -> dict[str, list[Any]]:
    keys = ("time", "weather_code", "temperature_2m_max", "temperature_2m_min")
    values = [daily.get(key) for key in keys]
    if not all(isinstance(value, list) for value in values):
        raise WeatherProviderError("每日預報格式無效")
    arrays = [value for value in values if isinstance(value, list)]
    clipped = {key: [] for key in keys}
    for index in range(min(len(value) for value in arrays)):
        day = str(arrays[0][index])
        if not start_date.isoformat() <= day <= end_date.isoformat():
            continue
        if not _complete_daily_slot(arrays[1][index], arrays[2][index], arrays[3][index]):
            continue
        for key, value in zip(keys, arrays, strict=True):
            clipped[key].append(value[index])
    return clipped


def _cached_forecast(cache_key: tuple[str, date, date]) -> WeatherForecastResponse | None:
    cached = _FORECAST_CACHE.get(cache_key)
    if cached is None:
        return None
    expires_at, payload = cached
    if expires_at <= time.monotonic():
        _FORECAST_CACHE.pop(cache_key, None)
        return None
    return WeatherForecastResponse.model_validate(payload)


async def _forecast_with_fallbacks(location: str, start_date: date, end_date: date) -> dict[str, Any]:
    coordinates: tuple[float, float] | None = None
    try:
        coordinates = await _resolve_coordinates(location)
    except WeatherProviderError as exc:
        _LOGGER.info("Open-Meteo 地理編碼不可用，改用備援：%s", exc)
    if coordinates is not None:
        try:
            return {"daily": await _fetch_open_meteo_forecast(coordinates, start_date, end_date)}
        except WeatherProviderError as exc:
            _LOGGER.info("Open-Meteo 天氣預報不可用，改用備援：%s", exc)
        try:
            return {"daily": await _fetch_met_no(coordinates, start_date, end_date)}
        except WeatherProviderError as exc:
            _LOGGER.info("met.no 天氣預報不可用，改用最終備援：%s", exc)
    try:
        return {"daily": await _fetch_wttr(location, start_date, end_date)}
    except WeatherProviderError as exc:
        _LOGGER.warning("所有天氣供應商皆失敗（地區=%r）：%s", location, exc)
        if coordinates is None:
            raise WeatherServiceError(
                404,
                "Unable to resolve weather location",
                error_code="weather_location_not_found",
            ) from exc
        raise WeatherServiceError(
            502,
            "All weather providers unavailable",
            error_code="weather_unavailable",
        ) from exc


async def get_forecast(
    location: str,
    start_date: date,
    end_date: date,
    *,
    force: bool = False,
) -> WeatherForecastResponse:
    """Validate, clip, cache, and execute one forecast request."""
    if end_date < start_date or (end_date - start_date).days + 1 > MAX_FORECAST_DAYS:
        raise WeatherServiceError(422, "Invalid weather forecast date range", error_code="weather_invalid_date_range")
    intersection = _forecast_intersection(start_date, end_date)
    if intersection is None:
        return _empty_forecast()
    clipped_start, clipped_end = intersection
    normalized_location = location.strip()
    cache_key = (normalized_location.casefold(), clipped_start, clipped_end)
    if force:
        _FORECAST_CACHE.pop(cache_key, None)
    else:
        cached = _cached_forecast(cache_key)
        if cached is not None:
            return cached
    try:
        payload = await asyncio.wait_for(
            _forecast_with_fallbacks(normalized_location, clipped_start, clipped_end),
            timeout=_FORECAST_WALL_TIMEOUT_SECONDS,
        )
        response = WeatherForecastResponse.model_validate(
            {"daily": _clip_daily(payload["daily"], clipped_start, clipped_end)}
        )
        _FORECAST_CACHE[cache_key] = (
            time.monotonic() + _FORECAST_CACHE_TTL_SECONDS,
            response.model_dump(),
        )
        return response
    except TimeoutError as exc:
        _LOGGER.warning("天氣預報總逾時（地區=%r）", normalized_location)
        raise WeatherServiceError(502, "Weather provider timed out", error_code="weather_timeout") from exc
    except (KeyError, TypeError, ValueError, WeatherProviderError) as exc:
        _LOGGER.warning("天氣供應商回傳無效資料（地區=%r）：%s", normalized_location, exc)
        raise WeatherServiceError(
            502,
            "Weather provider returned invalid data",
            error_code="weather_unavailable",
        ) from exc

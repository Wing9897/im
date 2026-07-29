"""Server-side Open-Meteo proxy for calendar forecasts.

Keeping these requests in the API process avoids renderer CORS restrictions and
keeps the third-party response shape out of the UI layer.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Any

import aiohttp
from fastapi import APIRouter, Query

from server.api.deps import API_DEPS
from server.api.schemas.responses import WeatherForecastResponse
from server.errors import http_error

router = APIRouter(prefix="/api/v1/weather", tags=["weather"], dependencies=API_DEPS)

_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_MET_NO_FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
_WTTR_URL = "https://wttr.in"
_REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10, connect=4, sock_read=7)
# Cap the whole multi-provider chain so a slow cascade cannot pin the event loop.
_FORECAST_WALL_TIMEOUT_SECONDS = 25.0
_MAX_FORECAST_DAYS = 62
_MET_NO_USER_AGENT = "IntelligenceMonitor/1.0 (local desktop weather client)"
_LOGGER = logging.getLogger(__name__)
_LOCATION_ALIASES = {
    "臺北": "Taipei",
    "台北": "Taipei",
    "臺中": "Taichung",
    "台中": "Taichung",
    "臺南": "Tainan",
    "台南": "Tainan",
    "高雄": "Kaohsiung",
}


class WeatherProviderError(Exception):
    """A third-party provider failed; callers may still try a fallback."""


async def _get_json(
    provider: str,
    url: str,
    params: dict[str, str],
    *,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Fetch one provider, retrying transient failures once."""
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            async with aiohttp.ClientSession(timeout=_REQUEST_TIMEOUT, headers=headers) as session:
                async with session.get(url, params=params, allow_redirects=False) as response:
                    if response.status >= 400:
                        body = (await response.text())[:200]
                        error = WeatherProviderError(f"HTTP {response.status}: {body!r}")
                        if response.status not in {408, 429} and response.status < 500:
                            raise error
                        last_error = error
                    else:
                        payload = await response.json(content_type=None)
                        if isinstance(payload, dict):
                            return payload
                        raise WeatherProviderError("回應不是 JSON 物件")
        except WeatherProviderError:
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            last_error = exc
        if attempt == 0:
            await asyncio.sleep(0.2)
    _LOGGER.warning("天氣供應商 %s 請求失敗：%s", provider, last_error)
    raise WeatherProviderError(str(last_error)) from last_error


async def _resolve_coordinates(location: str) -> tuple[float, float]:
    # Open-Meteo currently returns no result for some Traditional Chinese city
    # names (notably 臺北), while its English aliases resolve correctly.
    for query in dict.fromkeys((location, _LOCATION_ALIASES.get(location, location))):
        payload = await _get_json(
            "open-meteo-geocoding",
            _GEOCODING_URL,
            {"name": query, "count": "1", "language": "zh", "format": "json"},
        )
        results = payload.get("results")
        if not isinstance(results, list) or not results or not isinstance(results[0], dict):
            continue
        try:
            return float(results[0]["latitude"]), float(results[0]["longitude"])
        except (KeyError, TypeError, ValueError) as exc:
            raise WeatherProviderError("座標格式無效") from exc
    raise WeatherProviderError("找不到地區座標")


async def _fetch_open_meteo_forecast(
    coordinates: tuple[float, float], start_date: date, end_date: date
) -> dict[str, Any]:
    latitude, longitude = coordinates
    payload = await _get_json(
        "open-meteo-forecast",
        _FORECAST_URL,
        {
            "latitude": str(latitude),
            "longitude": str(longitude),
            "daily": "weather_code,temperature_2m_max,temperature_2m_min",
            "timezone": "auto",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
    )
    daily = payload.get("daily")
    if not isinstance(daily, dict):
        raise WeatherProviderError("未回傳每日預報")
    return daily


def _met_no_code(symbol: Any) -> int:
    value = str(symbol or "")
    if "thunder" in value:
        return 95
    if "snow" in value or "sleet" in value:
        return 71
    if "rain" in value:
        return 61
    if "fog" in value:
        return 45
    if "cloudy" in value:
        return 3
    if "partlycloudy" in value:
        return 2
    return 0


def _wttr_code(code: Any) -> int:
    """Translate wttr.in/WorldWeatherOnline condition codes to WMO codes."""
    try:
        value = int(code)
    except (TypeError, ValueError):
        return 3
    if value == 113:
        return 0
    if value == 116:
        return 1
    if value in {119, 122}:
        return 3
    if value in {143, 248, 260}:
        return 45
    if value == 200:
        return 95
    if value in {179, 182, 185, 227, 230, 317, 320, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377}:
        return 71
    return 61


async def _fetch_met_no(coordinates: tuple[float, float], start_date: date, end_date: date) -> dict[str, Any]:
    latitude, longitude = coordinates
    payload = await _get_json(
        "met.no",
        _MET_NO_FORECAST_URL,
        {"lat": str(latitude), "lon": str(longitude)},
        headers={"User-Agent": _MET_NO_USER_AGENT},
    )
    series = payload.get("properties", {}).get("timeseries")
    if not isinstance(series, list):
        raise WeatherProviderError("未回傳時間序列")
    days: dict[str, dict[str, object]] = {}
    for entry in series:
        if not isinstance(entry, dict) or not isinstance(entry.get("time"), str):
            continue
        day = entry["time"][:10]
        if not start_date.isoformat() <= day <= end_date.isoformat():
            continue
        details = entry.get("data", {}).get("instant", {}).get("details", {})
        temperature = details.get("air_temperature") if isinstance(details, dict) else None
        if not isinstance(temperature, (int, float)):
            continue
        bucket = days.setdefault(day, {"temperatures": [], "code": 0})
        temperatures = bucket["temperatures"]
        assert isinstance(temperatures, list)
        temperatures.append(float(temperature))
        summary = entry.get("data", {}).get("next_6_hours", {}).get("summary", {})
        bucket["code"] = _met_no_code(summary.get("symbol_code") if isinstance(summary, dict) else None)
    if not days:
        raise WeatherProviderError("請求日期不在 met.no 預報範圍")

    def _temps(bucket: dict[str, object]) -> list[float]:
        raw = bucket["temperatures"]
        assert isinstance(raw, list)
        return [float(v) for v in raw]

    return {
        "time": list(days),
        "weather_code": [bucket["code"] for bucket in days.values()],
        "temperature_2m_max": [max(_temps(bucket)) for bucket in days.values()],
        "temperature_2m_min": [min(_temps(bucket)) for bucket in days.values()],
    }


async def _fetch_wttr(location: str, start_date: date, end_date: date) -> dict[str, Any]:
    payload = await _get_json("wttr.in", f"{_WTTR_URL}/{location}", {"format": "j1"})
    forecast = payload.get("weather")
    if not isinstance(forecast, list):
        raise WeatherProviderError("未回傳每日預報")
    matching = [
        item
        for item in forecast
        if isinstance(item, dict) and start_date.isoformat() <= str(item.get("date", "")) <= end_date.isoformat()
    ]
    if not matching:
        raise WeatherProviderError("請求日期不在 wttr.in 預報範圍")
    try:
        return {
            "time": [str(item["date"]) for item in matching],
            "weather_code": [_wttr_code(item["hourly"][4]["weatherCode"]) for item in matching],
            "temperature_2m_max": [float(item["maxtempC"]) for item in matching],
            "temperature_2m_min": [float(item["mintempC"]) for item in matching],
        }
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise WeatherProviderError("每日預報格式無效") from exc


@router.get("/forecast", response_model=WeatherForecastResponse)
async def forecast(
    location: str = Query(min_length=1, max_length=120),
    start_date: date = Query(),
    end_date: date = Query(),
) -> WeatherForecastResponse:
    """Resolve a city then return compact daily Open-Meteo forecasts."""
    if end_date < start_date or (end_date - start_date).days + 1 > _MAX_FORECAST_DAYS:
        raise http_error(
            422,
            "Invalid weather forecast date range",
            error_code="weather_invalid_date_range",
        )

    try:
        payload = await asyncio.wait_for(
            _forecast_with_fallbacks(location.strip(), start_date, end_date),
            timeout=_FORECAST_WALL_TIMEOUT_SECONDS,
        )
        return WeatherForecastResponse.model_validate(payload)
    except asyncio.TimeoutError as exc:
        _LOGGER.warning("天氣預報總逾時（地區=%r）", location.strip())
        raise http_error(
            502,
            "Weather provider timed out",
            error_code="weather_timeout",
        ) from exc


async def _forecast_with_fallbacks(normalized_location: str, start_date: date, end_date: date) -> dict[str, Any]:
    coordinates: tuple[float, float] | None = None
    try:
        coordinates = await _resolve_coordinates(normalized_location)
    except WeatherProviderError as exc:
        _LOGGER.info("Open-Meteo 地理編碼不可用，改用備援：%s", exc)
    if coordinates is not None:
        try:
            return {"daily": await _fetch_open_meteo_forecast(coordinates, start_date, end_date)}
        except WeatherProviderError as exc:
            _LOGGER.info("Open-Meteo 天氣預報不可用，改用備援：%s", exc)

    if coordinates is not None:
        try:
            return {"daily": await _fetch_met_no(coordinates, start_date, end_date)}
        except WeatherProviderError as exc:
            _LOGGER.info("met.no 天氣預報不可用，改用最終備援：%s", exc)
    try:
        return {"daily": await _fetch_wttr(normalized_location, start_date, end_date)}
    except WeatherProviderError as exc:
        _LOGGER.warning("所有天氣供應商皆失敗（地區=%r）：%s", normalized_location, exc)
        if coordinates is None:
            raise http_error(
                404,
                "Unable to resolve weather location",
                error_code="weather_location_not_found",
            ) from exc
        raise http_error(
            502,
            "All weather providers unavailable",
            error_code="weather_unavailable",
        ) from exc

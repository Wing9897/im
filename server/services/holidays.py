"""Public-holiday overlay via Nager.Date, keyed by the weather location."""

from __future__ import annotations

import logging
import time
from typing import Any
from urllib.parse import urlsplit

import aiohttp

from server.api.schemas.responses import CalendarHolidayItemResponse, CalendarHolidaysResponse
from server.errors import http_error
from server.outbound import OutboundUrlError, validate_outbound_url
from server.services.holiday_country import country_from_weather_location, normalize_country_code
from server.services.weather_http import WeatherProviderError
from server.services.weather_providers import _geocode_first_result

_LOGGER = logging.getLogger(__name__)
_NAGER_HOST = "date.nager.at"
_NAGER_USER_AGENT = "IntelligenceMonitor/1.0 (local desktop calendar holidays)"
_REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10, connect=4, sock_read=7)
_CACHE_TTL_SECONDS = 12 * 60 * 60
_MIN_YEAR = 1970
_MAX_YEAR = 2100

# (year, country) → (expires_at, items)
_HOLIDAY_CACHE: dict[tuple[int, str], tuple[float, list[dict[str, Any]]]] = {}


def _nager_holidays_url(year: int, country: str) -> str:
    return f"https://{_NAGER_HOST}/api/v3/PublicHolidays/{year}/{country}"


def _empty_response(location: str, year: int, country: str | None) -> CalendarHolidaysResponse:
    return CalendarHolidaysResponse(year=year, location=location, country=country, holidays=[])


def _parse_nager_item(raw: object, country: str) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    date_value = raw.get("date")
    if not isinstance(date_value, str) or len(date_value) < 10:
        return None
    local_name = raw.get("localName")
    name = raw.get("name")
    types_raw = raw.get("types")
    types = [str(item) for item in types_raw] if isinstance(types_raw, list) else []
    item_country = normalize_country_code(raw.get("countryCode")) or country
    return {
        "date": date_value[:10],
        "localName": str(local_name) if local_name is not None else "",
        "name": str(name) if name is not None else "",
        "countryCode": item_country,
        "isGlobal": bool(raw.get("global", True)),
        "types": types,
    }


async def resolve_holiday_country(location: str) -> str | None:
    """Weather location string → ISO country (alias first, then Open-Meteo)."""
    mapped = country_from_weather_location(location)
    if mapped:
        return mapped
    try:
        result = await _geocode_first_result(location)
    except WeatherProviderError as exc:
        _LOGGER.info("節日地理編碼不可用（地區=%r）：%s", location, exc)
        return None
    if result is None:
        return None
    return normalize_country_code(result.get("country_code"))


async def _fetch_nager_json(year: int, country: str) -> list[Any] | None:
    """Fetch Nager.Date JSON; None means fail-soft (no overlay)."""
    url = _nager_holidays_url(year, country)
    if urlsplit(url).hostname != _NAGER_HOST:
        _LOGGER.warning("Nager.Date 主機不符：%s", url)
        return None
    try:
        await validate_outbound_url(url)
    except OutboundUrlError as exc:
        _LOGGER.warning("Nager.Date 出站檢查失敗：%s", exc)
        return None
    try:
        async with (
            aiohttp.ClientSession(timeout=_REQUEST_TIMEOUT) as session,
            session.get(
                url,
                headers={"User-Agent": _NAGER_USER_AGENT, "Accept": "application/json"},
                allow_redirects=False,
            ) as response,
        ):
            if response.status in {204, 404}:
                return []
            if response.status >= 400:
                body = (await response.text())[:200]
                _LOGGER.info("Nager.Date HTTP %s：%s", response.status, body)
                return None
            payload = await response.json(content_type=None)
            return payload if isinstance(payload, list) else None
    except (TimeoutError, aiohttp.ClientError, ValueError) as exc:
        _LOGGER.warning("Nager.Date 請求失敗（%s/%s）：%s", year, country, exc)
        return None


async def _holidays_for_country(year: int, country: str) -> list[dict[str, Any]]:
    cache_key = (year, country)
    cached = _HOLIDAY_CACHE.get(cache_key)
    if cached is not None:
        expires_at, items = cached
        if expires_at > time.monotonic():
            return items
        _HOLIDAY_CACHE.pop(cache_key, None)

    payload = await _fetch_nager_json(year, country)
    if payload is None:
        return []
    items = [parsed for raw in payload if (parsed := _parse_nager_item(raw, country)) is not None]
    _HOLIDAY_CACHE[cache_key] = (time.monotonic() + _CACHE_TTL_SECONDS, items)
    return items


async def get_holidays(location: str, year: int) -> CalendarHolidaysResponse:
    """Resolve weather location → country, then Nager holidays (fail-soft)."""
    if year < _MIN_YEAR or year > _MAX_YEAR:
        raise http_error(422, "Invalid holiday year", error_code="holiday_invalid_year")
    normalized = location.strip()
    if not normalized:
        raise http_error(422, "Invalid holiday location", error_code="holiday_invalid_location")

    country = await resolve_holiday_country(normalized)
    if country is None:
        return _empty_response(normalized, year, None)

    raw_items = await _holidays_for_country(year, country)
    holidays = [CalendarHolidayItemResponse.model_validate(item) for item in raw_items]
    return CalendarHolidaysResponse(
        year=year,
        location=normalized,
        country=country,
        holidays=holidays,
    )

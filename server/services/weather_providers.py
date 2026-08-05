"""Third-party weather provider clients (Open-Meteo / met.no / wttr.in)."""

from __future__ import annotations

from datetime import date
from typing import Any

from server.services.weather_http import WeatherProviderError, _get_json

_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_MET_NO_FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
_WTTR_URL = "https://wttr.in"
_MET_NO_USER_AGENT = "IntelligenceMonitor/1.0 (local desktop weather client)"
_LOCATION_ALIASES = {
    "臺北": "Taipei",
    "台北": "Taipei",
    "臺中": "Taichung",
    "台中": "Taichung",
    "臺南": "Tainan",
    "台南": "Tainan",
    "高雄": "Kaohsiung",
}


async def _resolve_coordinates(location: str) -> tuple[float, float]:
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
    return 2 if "partlycloudy" in value else 0


def _wttr_code(code: Any) -> int:
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
        temps = bucket.get("temperatures")
        if not isinstance(temps, list):
            temps = []
            bucket["temperatures"] = temps
        temps.append(float(temperature))
        summary = entry.get("data", {}).get("next_6_hours", {}).get("summary", {})
        bucket["code"] = _met_no_code(summary.get("symbol_code") if isinstance(summary, dict) else None)
    if not days:
        raise WeatherProviderError("請求日期不在 met.no 預報範圍")

    def temperatures(bucket: dict[str, object]) -> list[float]:
        values = bucket["temperatures"]
        assert isinstance(values, list)
        return [float(value) for value in values]

    return {
        "time": list(days),
        "weather_code": [bucket["code"] for bucket in days.values()],
        "temperature_2m_max": [max(temperatures(bucket)) for bucket in days.values()],
        "temperature_2m_min": [min(temperatures(bucket)) for bucket in days.values()],
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

"""Weather proxy route coverage (behavior + response-key contract)."""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import AsyncMock

import pytest

from server.services import weather
from server.tests.contract_helpers import assert_keys

WEATHER_DAILY_KEYS = ["time", "weather_code", "temperature_2m_max", "temperature_2m_min"]


def _sixteen_day_open_meteo_daily(*, trailing_none: bool = True) -> dict[str, list]:
    times = [(date(2026, 7, 1) + timedelta(days=offset)).isoformat() for offset in range(16)]
    weather_code: list[int | None] = list(range(16))
    temperature_2m_max: list[float | None] = [30.0 + offset for offset in range(16)]
    temperature_2m_min: list[float | None] = [20.0 + offset for offset in range(16)]
    if trailing_none:
        weather_code[-1] = None
        temperature_2m_max[-1] = None
        temperature_2m_min[-1] = None
    return {
        "time": times,
        "weather_code": weather_code,
        "temperature_2m_max": temperature_2m_max,
        "temperature_2m_min": temperature_2m_min,
    }


@pytest.fixture(autouse=True)
def _fixed_forecast_window(monkeypatch):
    monkeypatch.setattr(weather, "_today", lambda: date(2026, 7, 1))
    weather._FORECAST_CACHE.clear()


@pytest.mark.asyncio
async def test_weather_forecast_resolves_city_and_returns_daily_payload(client, monkeypatch):
    calls: list[tuple[float, float]] = []
    daily = {
        "time": ["2026-07-01"],
        "weather_code": [1],
        "temperature_2m_max": [33.2],
        "temperature_2m_min": [26.4],
    }

    async def fake_resolve(location: str):
        assert location == "臺北"
        return 25.033, 121.5654

    async def fake_open_meteo(coordinates, start_date, end_date):
        calls.append(coordinates)
        return daily

    monkeypatch.setattr(weather, "_resolve_coordinates", fake_resolve)
    monkeypatch.setattr(weather, "_fetch_open_meteo_forecast", fake_open_meteo)

    response = await client.get(
        "/api/v1/weather/forecast",
        params={"location": "臺北", "startDate": "2026-07-01", "endDate": "2026-07-01"},
    )

    assert response.status_code == 200
    body = response.json()
    assert_keys(body, ["daily"], "WeatherForecastResponse")
    assert_keys(body["daily"], WEATHER_DAILY_KEYS, "WeatherDaily")
    assert body["daily"]["time"] == ["2026-07-01"]
    assert calls == [(25.033, 121.5654)]


@pytest.mark.asyncio
async def test_weather_forecast_clips_to_available_window_and_provider_payload(client, monkeypatch):
    calls: list[tuple[date, date]] = []

    async def fake_forecast(location, start_date, end_date):
        assert location == "Taipei"
        calls.append((start_date, end_date))
        return {
            "daily": {
                "time": ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
                "weather_code": [1, 2, 3, 4],
                "temperature_2m_max": [31.0, 32.0, 33.0, 34.0],
                "temperature_2m_min": [21.0, 22.0, 23.0, 24.0],
            }
        }

    monkeypatch.setattr(weather, "_forecast_with_fallbacks", fake_forecast)
    response = await client.get(
        "/api/v1/weather/forecast",
        params={"location": "Taipei", "startDate": "2026-06-28", "endDate": "2026-07-03"},
    )

    assert response.status_code == 200
    assert calls == [(date(2026, 7, 1), date(2026, 7, 3))]
    assert response.json()["daily"]["time"] == ["2026-07-01", "2026-07-02", "2026-07-03"]


@pytest.mark.asyncio
async def test_weather_forecast_returns_empty_without_provider_call_when_out_of_window(client, monkeypatch):
    provider = AsyncMock()
    monkeypatch.setattr(weather, "_forecast_with_fallbacks", provider)

    response = await client.get(
        "/api/v1/weather/forecast",
        params={"location": "Taipei", "startDate": "2026-06-01", "endDate": "2026-06-30"},
    )

    assert response.status_code == 200
    assert response.json()["daily"] == {
        "time": [],
        "weather_code": [],
        "temperature_2m_max": [],
        "temperature_2m_min": [],
    }
    provider.assert_not_awaited()


@pytest.mark.asyncio
async def test_weather_forecast_reuses_successful_ttl_cache(client, monkeypatch):
    provider_calls = 0

    async def fake_forecast(location, start_date, end_date):
        nonlocal provider_calls
        provider_calls += 1
        return {
            "daily": {
                "time": ["2026-07-02"],
                "weather_code": [1],
                "temperature_2m_max": [31.0],
                "temperature_2m_min": [24.0],
            }
        }

    monkeypatch.setattr(weather, "_forecast_with_fallbacks", fake_forecast)
    params = {"location": "Taipei", "startDate": "2026-07-02", "endDate": "2026-07-02"}

    first = await client.get("/api/v1/weather/forecast", params=params)
    second = await client.get("/api/v1/weather/forecast", params=params)

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert provider_calls == 1


@pytest.mark.asyncio
async def test_weather_forecast_force_bypasses_ttl_cache(client, monkeypatch):
    provider_calls = 0

    async def fake_forecast(location, start_date, end_date):
        nonlocal provider_calls
        provider_calls += 1
        return {
            "daily": {
                "time": ["2026-07-02"],
                "weather_code": [provider_calls],
                "temperature_2m_max": [30.0 + provider_calls],
                "temperature_2m_min": [20.0 + provider_calls],
            }
        }

    monkeypatch.setattr(weather, "_forecast_with_fallbacks", fake_forecast)
    params = {"location": "Taipei", "startDate": "2026-07-02", "endDate": "2026-07-02"}

    first = await client.get("/api/v1/weather/forecast", params=params)
    forced = await client.get("/api/v1/weather/forecast", params={**params, "force": "true"})

    assert first.status_code == forced.status_code == 200
    assert provider_calls == 2
    assert forced.json()["daily"]["weather_code"] == [2]
    assert forced.json() != first.json()


@pytest.mark.asyncio
async def test_weather_provider_requests_reuse_shared_session(monkeypatch):
    class FakeResponse:
        status = 200

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def json(self, **kwargs):
            return {"ok": True}

    class FakeSession:
        closed = False

        def __init__(self):
            self.calls = 0

        def get(self, *args, **kwargs):
            self.calls += 1
            return FakeResponse()

    session = FakeSession()
    monkeypatch.setattr(weather, "_HTTP_SESSION", session)

    assert await weather._get_json("test", "https://example.test", {}) == {"ok": True}
    assert await weather._get_json("test", "https://example.test", {}) == {"ok": True}
    assert session.calls == 2


@pytest.mark.asyncio
async def test_weather_forecast_falls_back_to_met_no_after_open_meteo_failure(client, monkeypatch):
    daily = {
        "time": ["2026-07-01"],
        "weather_code": [3],
        "temperature_2m_max": [31.0],
        "temperature_2m_min": [25.0],
    }

    async def successful_met_no(coordinates, start_date, end_date):
        assert coordinates == (25.033, 121.5654)
        return daily

    async def failing_open_meteo(coordinates, start_date, end_date):
        raise weather.WeatherProviderError("forecast timeout")

    async def fake_resolve(location: str):
        return 25.033, 121.5654

    monkeypatch.setattr(weather, "_resolve_coordinates", fake_resolve)
    monkeypatch.setattr(weather, "_fetch_open_meteo_forecast", failing_open_meteo)
    monkeypatch.setattr(weather, "_fetch_met_no", successful_met_no)

    response = await client.get(
        "/api/v1/weather/forecast",
        params={"location": "Taipei", "startDate": "2026-07-01", "endDate": "2026-07-01"},
    )

    assert response.status_code == 200
    assert response.json()["daily"] == daily


def test_clip_daily_drops_trailing_null_slots():
    daily = _sixteen_day_open_meteo_daily()
    clipped = weather._clip_daily(daily, date(2026, 7, 1), date(2026, 7, 16))
    assert clipped["time"] == daily["time"][:15]
    assert clipped["weather_code"] == list(range(15))
    assert None not in clipped["weather_code"]
    assert None not in clipped["temperature_2m_max"]
    assert None not in clipped["temperature_2m_min"]


@pytest.mark.asyncio
async def test_weather_forecast_skips_trailing_null_day_in_16_day_window(client, monkeypatch):
    async def fake_forecast(location, start_date, end_date):
        assert (start_date, end_date) == (date(2026, 7, 1), date(2026, 7, 16))
        return {"daily": _sixteen_day_open_meteo_daily()}

    monkeypatch.setattr(weather, "_forecast_with_fallbacks", fake_forecast)
    response = await client.get(
        "/api/v1/weather/forecast",
        params={"location": "香港", "startDate": "2026-07-01", "endDate": "2026-07-16"},
    )

    assert response.status_code == 200
    body = response.json()
    assert_keys(body, ["daily"], "WeatherForecastResponse")
    assert_keys(body["daily"], WEATHER_DAILY_KEYS, "WeatherDaily")
    assert body["daily"]["time"] == _sixteen_day_open_meteo_daily()["time"][:15]
    assert body["daily"]["weather_code"] == list(range(15))
    assert len(body["daily"]["temperature_2m_max"]) == 15
    assert len(body["daily"]["temperature_2m_min"]) == 15


@pytest.mark.asyncio
async def test_weather_forecast_still_502s_on_non_null_invalid_daily(client, monkeypatch):
    async def fake_forecast(location, start_date, end_date):
        return {
            "daily": {
                "time": ["2026-07-01"],
                "weather_code": ["clear"],
                "temperature_2m_max": [31.0],
                "temperature_2m_min": [24.0],
            }
        }

    monkeypatch.setattr(weather, "_forecast_with_fallbacks", fake_forecast)
    response = await client.get(
        "/api/v1/weather/forecast",
        params={"location": "香港", "startDate": "2026-07-01", "endDate": "2026-07-01"},
    )

    assert response.status_code == 502
    assert response.json()["error_code"] == "weather_unavailable"


@pytest.mark.asyncio
async def test_weather_forecast_rejects_invalid_date_range(client):
    response = await client.get(
        "/api/v1/weather/forecast",
        params={"location": "臺北", "startDate": "2026-08-01", "endDate": "2026-07-01"},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["error_code"] == "weather_invalid_date_range"
    assert body["message"] == "Invalid weather forecast date range"

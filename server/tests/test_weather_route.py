"""Weather proxy route coverage (behavior + response-key contract)."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock

import pytest

from server.api.routes import weather
from server.tests.contract_helpers import assert_keys

WEATHER_DAILY_KEYS = ["time", "weather_code", "temperature_2m_max", "temperature_2m_min"]


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
        params={"location": "臺北", "start_date": "2026-07-01", "end_date": "2026-07-01"},
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
        params={"location": "Taipei", "start_date": "2026-06-28", "end_date": "2026-07-03"},
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
        params={"location": "Taipei", "start_date": "2026-06-01", "end_date": "2026-06-30"},
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
    params = {"location": "Taipei", "start_date": "2026-07-02", "end_date": "2026-07-02"}

    first = await client.get("/api/v1/weather/forecast", params=params)
    second = await client.get("/api/v1/weather/forecast", params=params)

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert provider_calls == 1


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
        params={"location": "Taipei", "start_date": "2026-07-01", "end_date": "2026-07-01"},
    )

    assert response.status_code == 200
    assert response.json()["daily"] == daily


@pytest.mark.asyncio
async def test_weather_forecast_rejects_invalid_date_range(client):
    response = await client.get(
        "/api/v1/weather/forecast",
        params={"location": "臺北", "start_date": "2026-08-01", "end_date": "2026-07-01"},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["error_code"] == "weather_invalid_date_range"
    assert body["message"] == "Invalid weather forecast date range"

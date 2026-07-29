"""Weather proxy route coverage (behavior + response-key contract)."""

from __future__ import annotations

import pytest

from server.api.routes import weather
from server.tests.contract_helpers import assert_keys

WEATHER_DAILY_KEYS = ["time", "weather_code", "temperature_2m_max", "temperature_2m_min"]


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

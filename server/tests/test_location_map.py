"""Unit tests: shared weather/holiday city table."""

from __future__ import annotations

import pytest

from server.services.holiday_country import country_from_weather_location
from server.services.location_map import geocode_queries_for_location
from server.services import weather_providers


def test_cjk_weather_cities_alias_to_english_geocode_query():
    assert geocode_queries_for_location("臺北") == ("臺北", "Taipei")
    assert geocode_queries_for_location("台北") == ("台北", "Taipei")
    assert geocode_queries_for_location("臺中") == ("臺中", "Taichung")
    assert geocode_queries_for_location("高雄") == ("高雄", "Kaohsiung")
    assert geocode_queries_for_location("香港") == ("香港", "Hong Kong")
    assert geocode_queries_for_location("東京") == ("東京", "Tokyo")
    assert geocode_queries_for_location("上海") == ("上海", "Shanghai")
    assert geocode_queries_for_location("新加坡") == ("新加坡", "Singapore")
    assert geocode_queries_for_location("首爾") == ("首爾", "Seoul")


def test_english_location_has_no_extra_geocode_query():
    assert geocode_queries_for_location("Taipei") == ("Taipei",)
    assert geocode_queries_for_location("Lyon") == ("Lyon",)
    assert geocode_queries_for_location("Unknownville") == ("Unknownville",)


def test_holiday_country_and_weather_aliases_share_the_same_cities():
    assert country_from_weather_location("臺北") == "TW"
    assert country_from_weather_location("高雄") == "TW"
    assert country_from_weather_location("香港") == "HK"
    assert country_from_weather_location("上海") == "CN"
    assert country_from_weather_location("Shanghai") == "CN"
    assert country_from_weather_location("首爾") == "KR"
    assert country_from_weather_location("Kaohsiung") == "TW"


@pytest.mark.asyncio
async def test_geocode_tries_english_alias_after_cjk_miss(monkeypatch):
    queries: list[str] = []

    async def fake_get_json(_provider, _url, params, headers=None):
        queries.append(params["name"])
        if params["name"] == "Taipei":
            return {"results": [{"latitude": 25.0, "longitude": 121.5, "country_code": "TW"}]}
        return {"results": []}

    monkeypatch.setattr(weather_providers, "_get_json", fake_get_json)
    result = await weather_providers._geocode_first_result("臺北")
    assert queries == ["臺北", "Taipei"]
    assert result is not None
    assert result["country_code"] == "TW"

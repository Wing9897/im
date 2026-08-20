"""Calendar holidays proxy: weather region → Nager.Date (mocked HTTP)."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from server.outbound import OutboundUrlError
from server.services import holidays
from server.tests.contract_helpers import assert_keys

HOLIDAY_RESPONSE_KEYS = ["year", "location", "country", "holidays"]
HOLIDAY_ITEM_KEYS = ["date", "localName", "name", "countryCode", "isGlobal", "types"]

_NAGER_TW_NEW_YEAR = {
    "date": "2026-01-01",
    "localName": "元旦",
    "name": "New Year's Day",
    "countryCode": "TW",
    "fixed": True,
    "global": True,
    "counties": None,
    "launchYear": None,
    "types": ["Public"],
}


@pytest.fixture(autouse=True)
def _clear_holiday_cache():
    holidays._HOLIDAY_CACHE.clear()
    yield
    holidays._HOLIDAY_CACHE.clear()


@pytest.mark.asyncio
async def test_holidays_maps_weather_city_and_returns_nager_payload(client, monkeypatch):
    fetch = AsyncMock(return_value=[_NAGER_TW_NEW_YEAR])
    geocode = AsyncMock(side_effect=AssertionError("alias path must not geocode"))
    monkeypatch.setattr(holidays, "_fetch_nager_json", fetch)
    monkeypatch.setattr(holidays, "_geocode_first_result", geocode)

    response = await client.get(
        "/api/v1/calendar/holidays",
        params={"year": 2026, "location": "臺北"},
    )

    assert response.status_code == 200
    body = response.json()
    assert_keys(body, HOLIDAY_RESPONSE_KEYS, "CalendarHolidaysResponse")
    assert body["year"] == 2026
    assert body["location"] == "臺北"
    assert body["country"] == "TW"
    assert len(body["holidays"]) == 1
    assert_keys(body["holidays"][0], HOLIDAY_ITEM_KEYS, "CalendarHolidayItem")
    assert body["holidays"][0]["date"] == "2026-01-01"
    assert body["holidays"][0]["localName"] == "元旦"
    assert body["holidays"][0]["isGlobal"] is True
    fetch.assert_awaited_once_with(2026, "TW")
    geocode.assert_not_called()


@pytest.mark.asyncio
async def test_holidays_geocodes_unknown_city_to_country(client, monkeypatch):
    async def fake_geocode(location: str):
        assert location == "Lyon"
        return {"latitude": 45.75, "longitude": 4.85, "country_code": "fr"}

    fetch = AsyncMock(return_value=[])
    monkeypatch.setattr(holidays, "_geocode_first_result", fake_geocode)
    monkeypatch.setattr(holidays, "_fetch_nager_json", fetch)

    response = await client.get(
        "/api/v1/calendar/holidays",
        params={"year": 2026, "location": "Lyon"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["country"] == "FR"
    assert body["holidays"] == []
    fetch.assert_awaited_once_with(2026, "FR")


@pytest.mark.asyncio
async def test_holidays_fail_soft_when_nager_is_down(client, monkeypatch):
    monkeypatch.setattr(holidays, "_fetch_nager_json", AsyncMock(return_value=None))

    response = await client.get(
        "/api/v1/calendar/holidays",
        params={"year": 2026, "location": "Taipei"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["country"] == "TW"
    assert body["holidays"] == []


@pytest.mark.asyncio
async def test_holidays_fail_soft_when_country_cannot_be_resolved(client, monkeypatch):
    monkeypatch.setattr(holidays, "_geocode_first_result", AsyncMock(return_value=None))
    fetch = AsyncMock(side_effect=AssertionError("must not call Nager without a country"))
    monkeypatch.setattr(holidays, "_fetch_nager_json", fetch)

    response = await client.get(
        "/api/v1/calendar/holidays",
        params={"year": 2026, "location": "Unknownville"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["country"] is None
    assert body["holidays"] == []
    fetch.assert_not_called()


@pytest.mark.asyncio
async def test_holidays_reject_invalid_year(client):
    response = await client.get(
        "/api/v1/calendar/holidays",
        params={"year": 1800, "location": "臺北"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_nager_fetch_validates_outbound_before_http(monkeypatch):
    seen: list[str] = []

    async def fake_validate(url: str, **_kwargs):
        seen.append(url)
        raise OutboundUrlError("blocked")

    monkeypatch.setattr(holidays, "validate_outbound_url", fake_validate)
    result = await holidays._fetch_nager_json(2026, "TW")
    assert result is None
    assert seen == ["https://date.nager.at/api/v3/PublicHolidays/2026/TW"]


def test_nager_url_uses_public_api_host():
    assert holidays._nager_holidays_url(2026, "TW") == ("https://date.nager.at/api/v3/PublicHolidays/2026/TW")

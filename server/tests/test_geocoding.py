from unittest.mock import MagicMock, patch

import pytest

from server.analyzer import geocoding as geocoding_mod
from server.analyzer.geocoding import (
    UNKNOWN_LOCATION,
    UNSPECIFIC_COORDINATES,
    _apply_sentinel,
    _build_geocode_query,
    _disambiguate_location,
    _extract_fallback_location,
    _geocode_items_sync,
    _parse_literal_coordinates,
    geocode_analysis_items,
)


@pytest.fixture(autouse=True)
def _clear_geocode_cache():
    geocoding_mod._geocode_cache.clear()
    yield
    geocoding_mod._geocode_cache.clear()


def test_parse_literal_coordinates():
    assert _parse_literal_coordinates("25.033, 121.5654") == (25.033, 121.5654)
    assert _parse_literal_coordinates("invalid") is None


def test_fallback_location_taipei():
    assert _extract_fallback_location("台北會議", "今日在台北舉行") == "台灣台北"


def test_disambiguate_texas_vs_dezhou_china():
    texas = _disambiguate_location(
        "德州",
        "SpaceX 第13次飛行測試發射 馬斯克預告星艦發射窗口於德州時間下午 5:45 開啟",
    )
    assert texas is not None
    assert "Texas" in texas or "德克薩斯" in texas

    dezhou = _disambiguate_location("德州", "山東省德州市平原縣舉行會議")
    assert dezhou == "中國山東省德州市"

    assert _disambiguate_location("德州", "今日天氣晴朗") is None


def test_build_geocode_query_appends_country_hint_for_short_names():
    assert _build_geocode_query("紐約", "美國紐約股市上漲") == "紐約, 美國紐約"
    assert _build_geocode_query("美國德克薩斯州 Texas, USA", "SpaceX") == ("美國德克薩斯州 Texas, USA")


def test_geocode_items_sync_rewrites_texas_before_nominatim():
    items = [
        {
            "title": "SpaceX 第13次飛行測試發射",
            "body": "馬斯克預告星艦發射窗口於德州時間下午 5:45 開啟。",
            "location": "德州",
        }
    ]
    mock_result = MagicMock()
    mock_result.latitude = 25.997
    mock_result.longitude = -97.157
    mock_geocode = MagicMock(return_value=mock_result)

    with patch("server.analyzer.geocoding._ensure_geocoder", return_value=mock_geocode):
        out = _geocode_items_sync(items)

    assert "Texas" in out[0]["location"] or "德克薩斯" in out[0]["location"]
    assert out[0]["latitude"] == 25.997
    assert out[0]["longitude"] == -97.157
    called_query = mock_geocode.call_args[0][0]
    assert "Texas" in called_query or "德克薩斯" in called_query


def test_apply_sentinel_uses_null_island_coordinates():
    item = {"location": "unknown", "latitude": 1.0, "longitude": 2.0}
    _apply_sentinel(item)
    assert item["location"] == UNKNOWN_LOCATION
    assert item["latitude"] == 0.0
    assert item["longitude"] == 0.0


@pytest.mark.parametrize(
    "location",
    ["", "unknown", "0,0", "0.0,0.0", "N/A", "未知", "全球", "網上", "online", "global"],
)
def test_geocode_items_sync_unknown_location_writes_zero_coords(location: str):
    items = [{"title": "t", "content": "c", "location": location}]
    out = _geocode_items_sync(items)
    assert out[0]["location"] == UNKNOWN_LOCATION
    assert out[0]["latitude"] == 0.0
    assert out[0]["longitude"] == 0.0


def test_geocode_items_sync_geocode_failure_writes_zero_coords():
    items = [{"title": "t", "content": "c", "location": "Nowhereville XYZ"}]
    mock_geocode = MagicMock(return_value=None)
    with patch("server.analyzer.geocoding._ensure_geocoder", return_value=mock_geocode):
        out = _geocode_items_sync(items)
    assert out[0]["latitude"] == UNSPECIFIC_COORDINATES[0]
    assert out[0]["longitude"] == UNSPECIFIC_COORDINATES[1]


def test_geocode_items_sync_batch_timeout_applies_sentinel_to_remaining():
    items = [
        {"title": "a", "content": "", "location": "Nowhere A"},
        {"title": "b", "content": "", "location": "Nowhere B"},
    ]
    mock_geocode = MagicMock(return_value=None)

    def slow_geocode(_location: str) -> None:
        return None

    mock_geocode.side_effect = slow_geocode

    with (
        patch("server.analyzer.geocoding._ensure_geocoder", return_value=mock_geocode),
        patch("server.analyzer.geocoding.time.monotonic", side_effect=[0.0, 0.0, 100.0]),
    ):
        out = _geocode_items_sync(items)

    assert out[0]["latitude"] == 0.0
    assert out[1]["location"] == UNKNOWN_LOCATION
    assert out[1]["latitude"] == 0.0
    assert out[1]["longitude"] == 0.0


async def test_geocode_analysis_items_literal():
    items = [{"title": "t", "content": "c", "location": "25.0,121.5", "latitude": None, "longitude": None}]
    out = await geocode_analysis_items(items)
    assert out[0]["latitude"] == 25.0
    assert out[0]["longitude"] == 121.5


def test_geocode_items_sync_reuses_cache_for_same_query():
    items = [
        {"title": "a", "content": "美國新聞", "location": "美國"},
        {"title": "b", "content": "美國股市", "location": "美國"},
    ]
    mock_result = MagicMock()
    mock_result.latitude = 39.8
    mock_result.longitude = -98.5
    mock_geocode = MagicMock(return_value=mock_result)

    with patch("server.analyzer.geocoding._ensure_geocoder", return_value=mock_geocode):
        out = _geocode_items_sync(items)

    assert mock_geocode.call_count == 1
    assert out[0]["latitude"] == 39.8
    assert out[1]["latitude"] == 39.8
    assert out[0]["longitude"] == -98.5
    assert out[1]["longitude"] == -98.5
    assert geocoding_mod._geocode_cache["美國"] == (39.8, -98.5)


def test_geocode_cache_keyed_by_post_disambiguation_query():
    items = [
        {
            "title": "SpaceX 發射",
            "body": "馬斯克預告星艦發射窗口於德州時間下午開啟。",
            "location": "德州",
        },
        {
            "title": "SpaceX 第二次",
            "body": "Starbase 德州時間再發射",
            "location": "德州",
        },
    ]
    mock_result = MagicMock()
    mock_result.latitude = 25.997
    mock_result.longitude = -97.157
    mock_geocode = MagicMock(return_value=mock_result)

    with patch("server.analyzer.geocoding._ensure_geocoder", return_value=mock_geocode):
        out = _geocode_items_sync(items)

    assert mock_geocode.call_count == 1
    called_query = mock_geocode.call_args[0][0]
    assert called_query in geocoding_mod._geocode_cache
    assert out[0]["latitude"] == 25.997
    assert out[1]["latitude"] == 25.997

"""Unit tests: weather location string → ISO 3166-1 alpha-2."""

from __future__ import annotations

from server.services.holiday_country import country_from_weather_location, normalize_country_code


def test_known_weather_cities_map_to_iso_country():
    assert country_from_weather_location("臺北") == "TW"
    assert country_from_weather_location("台北") == "TW"
    assert country_from_weather_location("Taipei") == "TW"
    assert country_from_weather_location("台中") == "TW"
    assert country_from_weather_location("高雄") == "TW"
    assert country_from_weather_location("  Hong Kong  ") == "HK"
    assert country_from_weather_location("東京") == "JP"
    assert country_from_weather_location("上海") == "CN"
    assert country_from_weather_location("Shanghai") == "CN"
    assert country_from_weather_location("New York") == "US"
    assert country_from_weather_location("Los Angeles") == "US"
    assert country_from_weather_location("London") == "GB"
    assert country_from_weather_location("Paris") == "FR"
    assert country_from_weather_location("新加坡") == "SG"
    assert country_from_weather_location("首爾") == "KR"


def test_unknown_or_blank_location_is_not_invented():
    assert country_from_weather_location("") is None
    assert country_from_weather_location("   ") is None
    assert country_from_weather_location("Unknownville") is None


def test_normalize_country_code_accepts_alpha2_only():
    assert normalize_country_code("tw") == "TW"
    assert normalize_country_code("GB") == "GB"
    assert normalize_country_code("TWN") is None
    assert normalize_country_code("T") is None
    assert normalize_country_code(None) is None
    assert normalize_country_code(86) is None

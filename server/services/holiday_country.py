"""Map the household weather location string to ISO 3166-1 alpha-2.

Nager.Date is country-level (not city / subdivision). Known weather cities
are mapped locally so holidays share the same region picker as weather
without a second control. Unknown names fall through to Open-Meteo
``country_code`` in ``services/holidays.py``.
"""

from __future__ import annotations

# Keys: exact CJK labels plus casefolded English forms used by weather / timezone.
_LOCATION_COUNTRY: dict[str, str] = {
    "臺北": "TW",
    "台北": "TW",
    "taipei": "TW",
    "臺中": "TW",
    "台中": "TW",
    "taichung": "TW",
    "臺南": "TW",
    "台南": "TW",
    "tainan": "TW",
    "高雄": "TW",
    "kaohsiung": "TW",
    "香港": "HK",
    "hong kong": "HK",
    "東京": "JP",
    "tokyo": "JP",
    "上海": "CN",
    "singapore": "SG",
    "新加坡": "SG",
    "首爾": "KR",
    "seoul": "KR",
    "new york": "US",
    "los angeles": "US",
    "london": "GB",
    "paris": "FR",
}


def normalize_country_code(raw: object) -> str | None:
    """Accept ISO 3166-1 alpha-2 (case-insensitive); reject anything else."""
    if not isinstance(raw, str):
        return None
    code = raw.strip().upper()
    if len(code) != 2 or not code.isalpha():
        return None
    return code


def country_from_weather_location(location: str) -> str | None:
    """Map a weather location query to a country code without network I/O."""
    key = location.strip()
    if not key:
        return None
    mapped = _LOCATION_COUNTRY.get(key) or _LOCATION_COUNTRY.get(key.casefold())
    return normalize_country_code(mapped)

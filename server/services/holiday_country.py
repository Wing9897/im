"""Map the household weather location string to ISO 3166-1 alpha-2.

Nager.Date is country-level (not city / subdivision). Known weather cities
are mapped locally so holidays share the same region picker as weather
without a second control. Unknown names fall through to Open-Meteo
``country_code`` in ``services/holidays.py``.

City table lives in ``services/location_map.py`` (shared with weather aliases).
"""

from __future__ import annotations

from server.services.location_map import LOCATION_COUNTRY as _LOCATION_COUNTRY


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

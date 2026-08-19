"""Household weather/holiday city table: aliases → geocode query and ISO country.

Nager.Date is country-level (not city / subdivision). Weather geocoding prefers
an English query for CJK labels. One table drives both so holidays share the
same region picker as weather without a second control. Unknown names fall
through to Open-Meteo.
"""

from __future__ import annotations

# (english_geocode_query, ISO 3166-1 alpha-2, aliases)
# Aliases: exact CJK labels plus casefolded English forms used by weather / TZ.
_LOCATION_ROWS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("Taipei", "TW", ("臺北", "台北", "taipei")),
    ("Taichung", "TW", ("臺中", "台中", "taichung")),
    ("Tainan", "TW", ("臺南", "台南", "tainan")),
    ("Kaohsiung", "TW", ("高雄", "kaohsiung")),
    ("Hong Kong", "HK", ("香港", "hong kong")),
    ("Tokyo", "JP", ("東京", "tokyo")),
    ("Shanghai", "CN", ("上海", "shanghai")),
    ("Singapore", "SG", ("新加坡", "singapore")),
    ("Seoul", "KR", ("首爾", "seoul")),
    ("New York", "US", ("new york",)),
    ("Los Angeles", "US", ("los angeles",)),
    ("London", "GB", ("london",)),
    ("Paris", "FR", ("paris",)),
)


def _build_maps() -> tuple[dict[str, str], dict[str, str]]:
    country: dict[str, str] = {}
    geocode_aliases: dict[str, str] = {}
    for query, iso, aliases in _LOCATION_ROWS:
        country[query] = iso
        country[query.casefold()] = iso
        for alias in aliases:
            country[alias] = iso
            country[alias.casefold()] = iso
            if alias != query:
                geocode_aliases[alias] = query
    return country, geocode_aliases


LOCATION_COUNTRY, LOCATION_GEOCODE_ALIASES = _build_maps()


def geocode_queries_for_location(location: str) -> tuple[str, ...]:
    """Ordered unique Open-Meteo queries: original, then English alias if any."""
    alias = LOCATION_GEOCODE_ALIASES.get(location) or LOCATION_GEOCODE_ALIASES.get(location.casefold())
    if alias and alias != location:
        return (location, alias)
    return (location,)

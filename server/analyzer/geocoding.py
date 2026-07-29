"""Geocode analysis event items via Nominatim."""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import TYPE_CHECKING, Any

from server.analyzer.geocoding_location import (
    UNKNOWN_LOCATION,
    UNSPECIFIC_COORDINATES,
    _build_geocode_query,
    _disambiguate_location,
    _extract_fallback_location,
    _is_unknown_location_token,
    _item_context_text,
    _normalize_location_value,
    _parse_literal_coordinates,
)

if TYPE_CHECKING:
    from server.db.database import Database

logger = logging.getLogger(__name__)

# Re-export location helpers for existing tests / callers.
__all__ = [
    "UNKNOWN_LOCATION",
    "UNSPECIFIC_COORDINATES",
    "_apply_sentinel",
    "_build_geocode_query",
    "_disambiguate_location",
    "_extract_fallback_location",
    "_geocode_items_sync",
    "_parse_literal_coordinates",
    "backfill_stored_events",
    "geocode_analysis_items",
]

_geocoder_lock = threading.Lock()
_geolocator: Any = None
_rate_limited_geocode: Any = None
#: Process-local cache keyed by post-disambiguation Nominatim query → (lat, lng).
_geocode_cache: dict[str, tuple[float, float]] = {}


def _ensure_geocoder() -> Any:
    global _geolocator, _rate_limited_geocode

    if _rate_limited_geocode is not None:
        return _rate_limited_geocode

    with _geocoder_lock:
        if _rate_limited_geocode is not None:
            return _rate_limited_geocode

        try:
            from geopy.extra.rate_limiter import RateLimiter
            from geopy.geocoders import Nominatim
        except ImportError as exc:
            raise RuntimeError("geopy is not installed; run: pip install geopy") from exc

        _geolocator = Nominatim(
            user_agent="intelligence-monitor-geocoder",
            timeout=10,  # pyright: ignore[reportArgumentType] — geopy stubs type timeout oddly
        )
        _rate_limited_geocode = RateLimiter(
            _geolocator.geocode,
            min_delay_seconds=1,
            max_retries=2,
            swallow_exceptions=False,
        )

    return _rate_limited_geocode


def _geocode_single(location: str, rate_limited_geocode: Any) -> tuple[float, float]:
    if _is_unknown_location_token(location):
        return UNSPECIFIC_COORDINATES
    try:
        from geopy.exc import (
            GeocoderQueryError,
            GeocoderServiceError,
            GeocoderTimedOut,
            GeocoderUnavailable,
            GeopyError,
        )

        result = rate_limited_geocode(location)
        if result is not None:
            return (result.latitude, result.longitude)
        return UNSPECIFIC_COORDINATES
    except ImportError:
        return UNSPECIFIC_COORDINATES
    except (
        GeocoderTimedOut,
        GeocoderServiceError,
        GeocoderUnavailable,
        GeocoderQueryError,
        GeopyError,
        OSError,
        asyncio.TimeoutError,
    ):
        logger.warning("Geocoding failed for location %r", location, exc_info=True)
        return UNSPECIFIC_COORDINATES


def _resolve_location(item: dict[str, Any]) -> str:
    context = _item_context_text(item)
    location = _normalize_location_value(item.get("location", ""))

    if location and location != "N/A":
        rewritten = _disambiguate_location(location, context)
        if rewritten and rewritten != location:
            logger.info(
                "Disambiguated location %r → %r (title=%r)",
                location,
                rewritten,
                item.get("title", ""),
            )
            item["location"] = rewritten
            return rewritten
        return location

    fallback = _extract_fallback_location(
        str(item.get("title") or ""),
        context,
    )
    if fallback:
        item["location"] = fallback
        logger.info(
            "Fallback location extracted: %r (from title=%r)",
            fallback,
            item.get("title", ""),
        )
    return fallback


def _apply_sentinel(item: dict[str, Any]) -> None:
    item["location"] = UNKNOWN_LOCATION
    item["latitude"], item["longitude"] = UNSPECIFIC_COORDINATES


def _geocode_item(item: dict[str, Any], geocode_fn: Any) -> Any:
    location = _resolve_location(item)

    if not location:
        _apply_sentinel(item)
        return geocode_fn

    if _is_unknown_location_token(location):
        _apply_sentinel(item)
        return geocode_fn

    direct_coordinates = _parse_literal_coordinates(location)
    if direct_coordinates is not None:
        item["location"] = f"{direct_coordinates[0]},{direct_coordinates[1]}"
        item["latitude"], item["longitude"] = direct_coordinates
        return geocode_fn

    query = _build_geocode_query(location, _item_context_text(item))
    with _geocoder_lock:
        cached = _geocode_cache.get(query)
        if cached is not None:
            item["latitude"], item["longitude"] = cached
            return geocode_fn

    # Ensure outside the geocode lock — _ensure_geocoder takes the same lock.
    if geocode_fn is None:
        geocode_fn = _ensure_geocoder()

    with _geocoder_lock:
        cached = _geocode_cache.get(query)
        if cached is not None:
            lat, lng = cached
        else:
            try:
                lat, lng = _geocode_single(query, geocode_fn)
            except Exception:
                logger.warning(
                    "Geocoding failed for location %r (query=%r)",
                    location,
                    query,
                    exc_info=True,
                )
                lat, lng = UNSPECIFIC_COORDINATES
            _geocode_cache[query] = (lat, lng)
    item["latitude"] = lat
    item["longitude"] = lng
    return geocode_fn


def _geocode_items_sync(items: list[dict]) -> list[dict]:
    if all(_is_unknown_location_token(_normalize_location_value(item.get("location", ""))) for item in items):
        for item in items:
            _apply_sentinel(item)
        logger.info("All %d items have unknown locations; skipping geocoding", len(items))
        return items

    geocode_fn: Any = None
    start_time = time.monotonic()
    total = len(items)
    batch_timeout = 60.0

    for idx, item in enumerate(items):
        if time.monotonic() - start_time > batch_timeout:
            logger.warning(
                "Geocoding batch timeout; skipping remaining %d/%d items",
                total - idx,
                total,
            )
            for remaining in items[idx:]:
                _apply_sentinel(remaining)
            break

        geocode_fn = _geocode_item(item, geocode_fn)

        if (idx + 1) % 10 == 0 or idx + 1 == total:
            logger.info(
                "Geocoding progress: %d/%d items (%.1fs elapsed)",
                idx + 1,
                total,
                time.monotonic() - start_time,
            )

    return items


async def geocode_analysis_items(items: list[dict]) -> list[dict]:
    """Geocode event items that have location strings."""
    if not items:
        return items
    try:
        return await asyncio.to_thread(_geocode_items_sync, items)
    except RuntimeError as exc:
        logger.warning("%s", exc)
        return items


_BACKFILL_SQL = (
    "SELECT id, title, body, location FROM analysis_events "
    "WHERE (latitude IS NULL OR longitude IS NULL) "
    "AND COALESCE(location, '') NOT IN ('0,0', '0.0,0.0', 'N/A')"
)


async def backfill_stored_events(db: Database) -> int:
    """Geocode existing analysis_events rows that have a location but no coordinates."""
    rows = await db.fetch_all(_BACKFILL_SQL)
    if not rows:
        return 0

    items = [
        {
            "id": row["id"],
            "title": row["title"],
            "content": row["body"],
            "location": row["location"],
            "latitude": None,
            "longitude": None,
        }
        for row in rows
    ]
    await geocode_analysis_items(items)

    update_rows: list[tuple[Any, ...]] = []
    for item in items:
        lat = item.get("latitude")
        lng = item.get("longitude")
        if lat is None and lng is None:
            continue
        update_rows.append((item.get("location"), lat, lng, item["id"]))

    if update_rows:
        await db.execute_many(
            "UPDATE analysis_events SET location = ?, latitude = ?, longitude = ? WHERE id = ?",
            update_rows,
        )
    return len(update_rows)

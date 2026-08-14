"""Bing daily (HPImageArchive) focal wallpaper metadata + image bytes.

No API key. Server-side fetch avoids browser CORS on the JSON archive.
Metadata returns an absolute https Bing image URL (credits / fallback).
``fetch_focal_background_image`` also proxies image bytes so the SPA can
paint via same-origin blob URLs (CSS ``background-image`` / ``<img>``)
without relying on Bing hotlink / Referer behavior.

Note: Bing's ``format`` query must be ``js`` for JSON. ``format=json``
returns XML (``text/xml``) and must not be used.
"""

from __future__ import annotations

import json
import logging
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urljoin

import aiohttp

from server.api.schemas.responses.theme import FocalBackgroundResponse
from server.errors import http_error

_LOGGER = logging.getLogger(__name__)
_BING_ARCHIVE_URL = "https://www.bing.com/HPImageArchive.aspx"
_BING_ORIGIN = "https://www.bing.com"
# Bing expects ``format=js`` for JSON; ``format=json`` yields XML.
_BING_FORMAT = "js"
_REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10, connect=4, sock_read=7)
_BING_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/javascript,application/xml,text/xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# (utc_day_iso, mkt, idx) → response payload
_CACHE: dict[tuple[str, str, int], FocalBackgroundResponse] = {}

# Bing HPImageArchive ``idx``: 0 = today, 1 = yesterday, … (cap at 7).
_FOCAL_IDX_MIN = 0
_FOCAL_IDX_MAX = 7


def clamp_focal_idx(idx: int | None) -> int:
    """Normalize Bing archive idx into 0–7 (inclusive)."""
    if idx is None:
        return 0
    try:
        value = int(idx)
    except (TypeError, ValueError):
        return 0
    return max(_FOCAL_IDX_MIN, min(_FOCAL_IDX_MAX, value))


_LOCALE_TO_MKT: dict[str, str] = {
    "en": "en-US",
    "en-US": "en-US",
    "en-GB": "en-GB",
    "zh-Hans": "zh-CN",
    "zh-CN": "zh-CN",
    "zh-Hant": "zh-HK",
    "zh-HK": "zh-HK",
    "zh-TW": "zh-TW",
}


def resolve_bing_mkt(locale: str | None) -> str:
    """Map app UI locale → Bing ``mkt``; unknown → en-US."""
    raw = (locale or "").strip()
    if not raw:
        return "en-US"
    if raw in _LOCALE_TO_MKT:
        return _LOCALE_TO_MKT[raw]
    # Accept already-valid Bing markets like ``ja-JP``.
    if len(raw) >= 5 and "-" in raw:
        return raw
    return "en-US"


def _utc_day() -> str:
    return datetime.now(UTC).date().isoformat()


def _clear_cache_for_tests() -> None:
    _CACHE.clear()


def _absolute_image_url(rel: str) -> str:
    rel = rel.strip()
    if rel.startswith("http://") or rel.startswith("https://"):
        return rel
    return urljoin(_BING_ORIGIN + "/", rel.lstrip("/"))


def parse_bing_archive(payload: dict[str, Any], *, mkt: str) -> FocalBackgroundResponse:
    """Parse HPImageArchive JSON into a wire response (pure; for unit tests)."""
    images = payload.get("images")
    if not isinstance(images, list) or not images:
        raise ValueError("Bing archive missing images")
    first = images[0]
    if not isinstance(first, dict):
        raise TypeError("Bing archive image entry invalid")
    rel = first.get("url") or first.get("urlbase")
    if not isinstance(rel, str) or not rel.strip():
        raise ValueError("Bing archive missing image url")
    title = first.get("title")
    copyright_ = first.get("copyright")
    start = first.get("startdate")
    return FocalBackgroundResponse(
        imageUrl=_absolute_image_url(rel),
        title=title if isinstance(title, str) and title.strip() else None,
        copyright=copyright_ if isinstance(copyright_, str) and copyright_.strip() else None,
        date=start if isinstance(start, str) and start.strip() else None,
        locale=mkt,
        source="bing",
    )


def parse_bing_archive_xml(body: str, *, mkt: str) -> FocalBackgroundResponse:
    """Parse HPImageArchive XML (returned when ``format=json`` or similar)."""
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise ValueError("Bing archive XML unparseable") from exc
    image = root.find("image")
    if image is None:
        raise ValueError("Bing archive XML missing image")
    url_el = image.find("url")
    urlbase_el = image.find("urlBase")
    rel = (url_el.text if url_el is not None else None) or (urlbase_el.text if urlbase_el is not None else None)
    if not isinstance(rel, str) or not rel.strip():
        raise ValueError("Bing archive XML missing image url")
    title_el = image.find("title")
    copyright_el = image.find("copyright")
    start_el = image.find("startdate")
    title = title_el.text if title_el is not None else None
    copyright_ = copyright_el.text if copyright_el is not None else None
    start = start_el.text if start_el is not None else None
    return FocalBackgroundResponse(
        imageUrl=_absolute_image_url(rel),
        title=title.strip() if isinstance(title, str) and title.strip() else None,
        copyright=copyright_.strip() if isinstance(copyright_, str) and copyright_.strip() else None,
        date=start.strip() if isinstance(start, str) and start.strip() else None,
        locale=mkt,
        source="bing",
    )


def _decode_archive_body(body: str, *, content_type: str | None, mkt: str) -> FocalBackgroundResponse:
    """Prefer JSON; fall back to XML when Bing ignores ``format=js``."""
    stripped = body.lstrip()
    ct = (content_type or "").lower()
    looks_xml = stripped.startswith("<?xml") or stripped.startswith("<images") or "xml" in ct
    if not looks_xml:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Bing archive JSON unparseable (ct={content_type!r})") from exc
        if not isinstance(payload, dict):
            raise ValueError("Bing archive JSON root is not an object")
        return parse_bing_archive(payload, mkt=mkt)
    _LOGGER.info("Bing archive returned XML (mkt=%s, ct=%s); parsing XML fallback", mkt, content_type)
    return parse_bing_archive_xml(body, mkt=mkt)


async def fetch_focal_background(
    locale: str | None = None,
    idx: int | None = None,
) -> FocalBackgroundResponse:
    """Return Bing wallpaper metadata for ``idx`` (0=today…7), cached per UTC day+mkt+idx."""
    mkt = resolve_bing_mkt(locale)
    archive_idx = clamp_focal_idx(idx)
    cache_key = (_utc_day(), mkt, archive_idx)
    cached = _CACHE.get(cache_key)
    if cached is not None:
        return cached

    params = {
        "format": _BING_FORMAT,
        "idx": str(archive_idx),
        "n": "1",
        "mkt": mkt,
    }
    try:
        timeout = _REQUEST_TIMEOUT
        async with (
            aiohttp.ClientSession(timeout=timeout, headers=_BING_HEADERS) as session,
            session.get(_BING_ARCHIVE_URL, params=params) as response,
        ):
            body = await response.text()
            content_type = response.headers.get("Content-Type")
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status} ct={content_type!r}: {body[:200]!r}")
    except Exception as exc:
        _LOGGER.warning("Bing focal background fetch failed (mkt=%s): %s", mkt, exc)
        raise http_error(
            502,
            "Focal background upstream unavailable",
            error_code="FOCAL_BACKGROUND_UNAVAILABLE",
            details={"source": "bing", "locale": mkt},
        ) from exc

    try:
        result = _decode_archive_body(body, content_type=content_type, mkt=mkt)
    except (TypeError, ValueError) as exc:
        _LOGGER.warning(
            "Bing focal background payload incomplete (mkt=%s, ct=%s): %s; body=%r",
            mkt,
            content_type,
            exc,
            body[:200],
        )
        raise http_error(
            502,
            "Focal background upstream payload incomplete",
            error_code="FOCAL_BACKGROUND_UNAVAILABLE",
            details={"source": "bing", "locale": mkt},
        ) from exc

    # Drop stale days so the process cache does not grow unbounded.
    stale = [key for key in _CACHE if key[0] != cache_key[0]]
    for key in stale:
        del _CACHE[key]
    _CACHE[cache_key] = result
    return result


def _guess_image_media_type(url: str, content_type: str | None) -> str:
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct.startswith("image/"):
        return ct
    lower = url.lower()
    if ".png" in lower:
        return "image/png"
    if ".webp" in lower:
        return "image/webp"
    if ".gif" in lower:
        return "image/gif"
    return "image/jpeg"


async def fetch_focal_background_image(
    locale: str | None = None,
    idx: int | None = None,
) -> tuple[bytes, str]:
    """Fetch focal image bytes via server-side Bing hotlink (auth'd SPA proxy)."""
    meta = await fetch_focal_background(locale, idx=idx)
    url = meta.imageUrl
    try:
        timeout = _REQUEST_TIMEOUT
        async with (
            aiohttp.ClientSession(timeout=timeout, headers=_BING_HEADERS) as session,
            session.get(url) as response,
        ):
            if response.status >= 400:
                body_preview = (await response.text())[:200]
                raise RuntimeError(
                    f"HTTP {response.status} ct={response.headers.get('Content-Type')!r}: {body_preview!r}"
                )
            data = await response.read()
            if not data:
                raise RuntimeError("empty image body")
            media_type = _guess_image_media_type(url, response.headers.get("Content-Type"))
            return data, media_type
    except Exception as exc:
        _LOGGER.warning("Bing focal image byte fetch failed (url=%s): %s", url, exc)
        raise http_error(
            502,
            "Focal background image upstream unavailable",
            error_code="FOCAL_BACKGROUND_UNAVAILABLE",
            details={"source": "bing", "locale": meta.locale},
        ) from exc

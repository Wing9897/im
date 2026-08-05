"""Shared HTTP session and JSON fetch for weather providers."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import aiohttp

_REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10, connect=4, sock_read=7)
_LOGGER = logging.getLogger(__name__)
_HTTP_SESSION: aiohttp.ClientSession | None = None


class WeatherProviderError(Exception):
    """A third-party provider failed; callers may still try a fallback."""


async def _get_json(
    provider: str,
    url: str,
    params: dict[str, str],
    *,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Fetch one provider, retrying transient failures once."""
    global _HTTP_SESSION
    if _HTTP_SESSION is None or _HTTP_SESSION.closed:
        _HTTP_SESSION = aiohttp.ClientSession(timeout=_REQUEST_TIMEOUT)
    session = _HTTP_SESSION
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            async with session.get(url, params=params, headers=headers, allow_redirects=False) as response:
                if response.status >= 400:
                    body = (await response.text())[:200]
                    error = WeatherProviderError(f"HTTP {response.status}: {body!r}")
                    if response.status not in {408, 429} and response.status < 500:
                        raise error
                    last_error = error
                else:
                    payload = await response.json(content_type=None)
                    if isinstance(payload, dict):
                        return payload
                    raise WeatherProviderError("回應不是 JSON 物件")
        except WeatherProviderError:
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            last_error = exc
        if attempt == 0:
            await asyncio.sleep(0.2)
    _LOGGER.warning("天氣供應商 %s 請求失敗：%s", provider, last_error)
    raise WeatherProviderError(str(last_error)) from last_error

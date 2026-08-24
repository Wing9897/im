"""Shared HTTP helpers and keyed-search runner for web-search engines."""

from __future__ import annotations

import html
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urlencode

import aiohttp

from server.domain.web_search_providers import secret_column_for
from server.outbound import OutboundUrlError

logger = logging.getLogger(__name__)

DEFAULT_COUNT = 5
MAX_COUNT = 8
REQUEST_TIMEOUT_S = 12
# DuckDuckGo lite/html returns 403 without a browser-like UA.
_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
}

_TAG_RE = re.compile(r"<[^>]+>")


def _clamp_count(count: int | None) -> int:
    if count is None:
        return DEFAULT_COUNT
    try:
        value = int(count)
    except (TypeError, ValueError):
        return DEFAULT_COUNT
    return max(1, min(value, MAX_COUNT))


def _strip_html(text: str) -> str:
    return html.unescape(_TAG_RE.sub("", text or "")).strip()


def _item(title: str, url: str, snippet: str = "") -> dict[str, str]:
    return {
        "title": (title or url or "").strip()[:300],
        "url": (url or "").strip(),
        "snippet": (snippet or "").strip()[:500],
    }


def _normalize_items(items: list[dict[str, str]], *, count: int) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for item in items:
        url = item.get("url") or ""
        if not url or url in seen:
            continue
        # Instant Answer related topics often include DuckDuckGo category pages.
        if "duckduckgo.com" in url:
            continue
        seen.add(url)
        out.append(item)
        if len(out) >= count:
            break
    return out


async def _validate_outbound(url: str) -> None:
    # Late bind so tests can patch ``server.web_search.providers.validate_outbound_url``.
    from server.web_search.providers import validate_outbound_url

    await validate_outbound_url(url)


async def _fetch_text(session: aiohttp.ClientSession, url: str) -> str:
    await _validate_outbound(url)
    async with session.get(url, headers=_REQUEST_HEADERS, allow_redirects=False) as resp:
        resp.raise_for_status()
        return await resp.text()


async def _fetch_json(session: aiohttp.ClientSession, url: str, *, headers: dict[str, str] | None = None) -> Any:
    await _validate_outbound(url)
    merged = {**_REQUEST_HEADERS, **(headers or {})}
    async with session.get(url, headers=merged, allow_redirects=False) as resp:
        resp.raise_for_status()
        return await resp.json(content_type=None)


async def _post_json(
    session: aiohttp.ClientSession,
    url: str,
    *,
    json_body: dict[str, Any],
    headers: dict[str, str] | None = None,
) -> Any:
    await _validate_outbound(url)
    merged = {**_REQUEST_HEADERS, **(headers or {})}
    async with session.post(url, json=json_body, headers=merged, allow_redirects=False) as resp:
        resp.raise_for_status()
        return await resp.json(content_type=None)


def _missing_key_result(provider: str) -> dict[str, Any]:
    return {
        "error": f"{secret_column_for(provider)} not configured",
        "items": [],
        "provider": provider,
        "count": 0,
    }


def _search_failed(provider: str, exc: BaseException) -> dict[str, Any]:
    return {
        "error": f"{provider} search failed: {exc}",
        "items": [],
        "provider": provider,
        "count": 0,
    }


def _items_from_result_rows(rows: Any, *, url_key: str, snippet_key: str, count: int) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    if not isinstance(rows, list):
        return items
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()
        href = str(row.get(url_key) or row.get("url") or "").strip()
        snippet = str(row.get(snippet_key) or row.get("content") or row.get("snippet") or "").strip()
        if href:
            items.append(_item(title or href, href, snippet))
    return _normalize_items(items, count=count)


@dataclass(frozen=True, slots=True)
class KeyedSearchSpec:
    """One paid search vendor. HTTP verb / URL / parse keys stay here — not in callers."""

    provider: str
    url: str
    method: Literal["get", "post"]
    url_key: str
    snippet_key: str
    results_key: str = "results"
    #: Brave nests hits under ``web.results``.
    nested_web: bool = False
    header_builder: Callable[[str], dict[str, str]] = lambda _key: {}
    body_builder: Callable[[str, str, int], dict[str, Any]] | None = None
    query_builder: Callable[[str, int], dict[str, str]] | None = None


def _bearer_headers(key: str) -> dict[str, str]:
    return {"Accept": "application/json", "Authorization": f"Bearer {key}"}


def _extract_result_rows(data: Any, spec: KeyedSearchSpec) -> Any:
    if not isinstance(data, dict):
        return None
    if spec.nested_web:
        web = data.get("web")
        return web.get("results") if isinstance(web, dict) else None
    return data.get(spec.results_key)


async def run_keyed_search(
    spec: KeyedSearchSpec,
    query: str,
    *,
    api_key: str,
    count: int | None,
) -> dict[str, Any]:
    key = (api_key or "").strip()
    if not key:
        return _missing_key_result(spec.provider)
    limit = _clamp_count(count)
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT_S)
    headers = spec.header_builder(key)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if spec.method == "get":
                params = spec.query_builder(query, limit) if spec.query_builder else {}
                url = f"{spec.url}?{urlencode(params)}" if params else spec.url
                data = await _fetch_json(session, url, headers=headers)
            else:
                body = spec.body_builder(key, query, limit) if spec.body_builder else {}
                data = await _post_json(session, spec.url, json_body=body, headers=headers)
    except (aiohttp.ClientError, OutboundUrlError, OSError, ValueError) as exc:
        logger.warning("%s search failed: %s", spec.provider.capitalize(), exc)
        return _search_failed(spec.provider, exc)
    items = _items_from_result_rows(
        _extract_result_rows(data, spec),
        url_key=spec.url_key,
        snippet_key=spec.snippet_key,
        count=limit,
    )
    return {"items": items, "provider": spec.provider, "count": len(items)}

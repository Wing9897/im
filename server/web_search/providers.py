"""DuckDuckGo (default, no key) plus Brave / Tavily / Perplexity / Serper Search providers."""

from __future__ import annotations

import html
import logging
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlencode, urlparse

import aiohttp

from server.outbound import OutboundUrlError, validate_outbound_url

logger = logging.getLogger(__name__)

DDG_INSTANT_URL = "https://api.duckduckgo.com/"
DDG_LITE_URL = "https://lite.duckduckgo.com/lite/"
BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search"
SERPER_SEARCH_URL = "https://google.serper.dev/search"

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


def unwrap_ddg_redirect(url: str) -> str:
    """Resolve DuckDuckGo lite redirect links (``/l/?uddg=...``) to the target URL."""
    raw = (url or "").strip()
    if not raw:
        return raw
    try:
        parsed = urlparse(raw)
    except ValueError:
        return raw
    host = (parsed.netloc or "").lower()
    if "duckduckgo.com" not in host:
        return raw
    if "/l/" not in (parsed.path or ""):
        return raw
    uddg = parse_qs(parsed.query).get("uddg") or []
    if not uddg:
        return raw
    target = unquote(uddg[0]).strip()
    return target or raw


_LITE_RESULT_RE = re.compile(
    r'<a[^>]+rel="nofollow"[^>]+href="(?P<url>(?:https?:)?//[^"]+)"[^>]*>(?P<title>.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _normalize_href(url: str) -> str:
    href = html.unescape((url or "").strip())
    if href.startswith("//"):
        href = "https:" + href
    return unwrap_ddg_redirect(href)


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


def _collect_ddg_related(nodes: Any, out: list[dict[str, str]]) -> None:
    if not isinstance(nodes, list):
        return
    for node in nodes:
        if not isinstance(node, dict):
            continue
        if isinstance(node.get("Topics"), list):
            _collect_ddg_related(node["Topics"], out)
            continue
        url = str(node.get("FirstURL") or "").strip()
        text = str(node.get("Text") or "").strip()
        if url and text:
            out.append(_item(text, url, text))


async def _fetch_text(session: aiohttp.ClientSession, url: str) -> str:
    await validate_outbound_url(url)
    async with session.get(url, headers=_REQUEST_HEADERS, allow_redirects=False) as resp:
        resp.raise_for_status()
        return await resp.text()


async def _fetch_json(session: aiohttp.ClientSession, url: str, *, headers: dict[str, str] | None = None) -> Any:
    await validate_outbound_url(url)
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
    await validate_outbound_url(url)
    merged = {**_REQUEST_HEADERS, **(headers or {})}
    async with session.post(url, json=json_body, headers=merged, allow_redirects=False) as resp:
        resp.raise_for_status()
        return await resp.json(content_type=None)


def _missing_key_result(provider: str, config_key: str | None = None) -> dict[str, Any]:
    return {
        "error": f"{config_key or f'{provider}_search_api_key'} not configured",
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


async def _search_duckduckgo_instant(session: aiohttp.ClientSession, query: str, count: int) -> list[dict[str, str]]:
    params = urlencode(
        {
            "q": query,
            "format": "json",
            "no_html": "1",
            "skip_disambig": "1",
        }
    )
    data = await _fetch_json(session, f"{DDG_INSTANT_URL}?{params}")
    if not isinstance(data, dict):
        return []
    items: list[dict[str, str]] = []
    abstract = str(data.get("AbstractText") or "").strip()
    abstract_url = str(data.get("AbstractURL") or "").strip()
    if abstract and abstract_url:
        heading = str(data.get("Heading") or abstract[:80])
        items.append(_item(heading, abstract_url, abstract))
    for row in data.get("Results") or []:
        if not isinstance(row, dict):
            continue
        url = str(row.get("FirstURL") or "").strip()
        text = str(row.get("Text") or "").strip()
        if url and text:
            items.append(_item(text, url, text))
    _collect_ddg_related(data.get("RelatedTopics"), items)
    return _normalize_items(items, count=count)


async def _search_duckduckgo_lite(session: aiohttp.ClientSession, query: str, count: int) -> list[dict[str, str]]:
    url = f"{DDG_LITE_URL}?{urlencode({'q': query})}"
    body = await _fetch_text(session, url)
    items: list[dict[str, str]] = []
    for match in _LITE_RESULT_RE.finditer(body):
        title = _strip_html(match.group("title"))
        href = _normalize_href(match.group("url"))
        if not title or not href:
            continue
        # Skip DuckDuckGo chrome / self links (keep unwrapped external targets)
        if "duckduckgo.com" in href:
            continue
        items.append(_item(title, href, title))
        if len(items) >= count:
            break
    return _normalize_items(items, count=count)


async def search_duckduckgo(query: str, *, count: int | None = None) -> dict[str, Any]:
    limit = _clamp_count(count)
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT_S)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        try:
            items = await _search_duckduckgo_instant(session, query, limit)
        except (aiohttp.ClientError, OutboundUrlError, OSError, ValueError) as exc:
            logger.warning("DuckDuckGo Instant Answer failed: %s", exc)
            items = []
        if not items:
            try:
                items = await _search_duckduckgo_lite(session, query, limit)
            except (aiohttp.ClientError, OutboundUrlError, OSError, ValueError) as exc:
                logger.warning("DuckDuckGo lite fallback failed: %s", exc)
                return {"error": f"duckduckgo search failed: {exc}", "items": [], "provider": "duckduckgo", "count": 0}
    return {"items": items, "provider": "duckduckgo", "count": len(items)}


async def search_brave(query: str, *, api_key: str, count: int | None = None) -> dict[str, Any]:
    key = (api_key or "").strip()
    if not key:
        return _missing_key_result("brave")
    limit = _clamp_count(count)
    params = urlencode({"q": query, "count": str(limit)})
    url = f"{BRAVE_SEARCH_URL}?{params}"
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT_S)
    headers = {"Accept": "application/json", "X-Subscription-Token": key}
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            data = await _fetch_json(session, url, headers=headers)
    except (aiohttp.ClientError, OutboundUrlError, OSError, ValueError) as exc:
        logger.warning("Brave search failed: %s", exc)
        return _search_failed("brave", exc)

    web = data.get("web") if isinstance(data, dict) else None
    results = web.get("results") if isinstance(web, dict) else None
    items = _items_from_result_rows(results, url_key="url", snippet_key="description", count=limit)
    return {"items": items, "provider": "brave", "count": len(items)}


async def _keyed_post_search(
    query: str,
    *,
    provider: str,
    api_key: str,
    count: int | None,
    url: str,
    headers: dict[str, str],
    body: dict[str, Any],
    results_key: str,
    url_key: str,
    snippet_key: str,
) -> dict[str, Any]:
    """Shared POST JSON search (Tavily / Perplexity / Serper). Key + vendor URL stay in the wrapper."""
    key = (api_key or "").strip()
    if not key:
        return _missing_key_result(provider)
    limit = _clamp_count(count)
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT_S)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            data = await _post_json(session, url, json_body=body, headers=headers)
    except (aiohttp.ClientError, OutboundUrlError, OSError, ValueError) as exc:
        logger.warning("%s search failed: %s", provider.capitalize(), exc)
        return _search_failed(provider, exc)
    results = data.get(results_key) if isinstance(data, dict) else None
    items = _items_from_result_rows(results, url_key=url_key, snippet_key=snippet_key, count=limit)
    return {"items": items, "provider": provider, "count": len(items)}


async def search_tavily(query: str, *, api_key: str, count: int | None = None) -> dict[str, Any]:
    """Official Tavily Search (``POST /search``), not crawl / extract / research."""
    key = (api_key or "").strip()
    limit = _clamp_count(count)
    return await _keyed_post_search(
        query,
        provider="tavily",
        api_key=key,
        count=limit,
        url=TAVILY_SEARCH_URL,
        headers={"Accept": "application/json", "Authorization": f"Bearer {key}"},
        body={"api_key": key, "query": query, "max_results": limit, "search_depth": "basic"},
        results_key="results",
        url_key="url",
        snippet_key="content",
    )


async def search_perplexity(query: str, *, api_key: str, count: int | None = None) -> dict[str, Any]:
    """Official Perplexity Search API (``POST /search``), not Sonar chat completions."""
    key = (api_key or "").strip()
    limit = _clamp_count(count)
    return await _keyed_post_search(
        query,
        provider="perplexity",
        api_key=key,
        count=limit,
        url=PERPLEXITY_SEARCH_URL,
        headers={"Accept": "application/json", "Authorization": f"Bearer {key}"},
        body={"query": query, "max_results": limit},
        results_key="results",
        url_key="url",
        snippet_key="snippet",
    )


async def search_serper(query: str, *, api_key: str, count: int | None = None) -> dict[str, Any]:
    """Official Serper Search API (``POST /search``), not HTML scraping."""
    key = (api_key or "").strip()
    limit = _clamp_count(count)
    return await _keyed_post_search(
        query,
        provider="serper",
        api_key=key,
        count=limit,
        url=SERPER_SEARCH_URL,
        headers={"Accept": "application/json", "X-API-KEY": key},
        body={"q": query, "num": limit},
        results_key="organic",
        url_key="link",
        snippet_key="snippet",
    )


_KEYED_SEARCHERS = {
    "brave": search_brave,
    "tavily": search_tavily,
    "perplexity": search_perplexity,
    "serper": search_serper,
}


async def search_web(
    query: str,
    *,
    provider: str = "duckduckgo",
    api_key: str = "",
    count: int | None = None,
) -> dict[str, Any]:
    q = (query or "").strip()
    if not q:
        return {"error": "query is required", "items": [], "provider": provider or "duckduckgo", "count": 0}
    # Keep query length bounded for outbound URLs
    q = q[:500]
    name = (provider or "duckduckgo").strip().lower()
    keyed = _KEYED_SEARCHERS.get(name)
    if keyed is not None:
        return await keyed(q, api_key=api_key, count=count)
    if name != "duckduckgo":
        return {
            "error": f"unsupported web_search_provider: {provider}",
            "items": [],
            "provider": name,
            "count": 0,
        }
    return await search_duckduckgo(q, count=count)

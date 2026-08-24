"""DuckDuckGo Instant Answer + lite HTML fallback (default, no API key)."""

from __future__ import annotations

import html
import logging
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlencode, urlparse

import aiohttp

from server.outbound import OutboundUrlError
from server.web_search._common import (
    REQUEST_TIMEOUT_S,
    _clamp_count,
    _fetch_json,
    _fetch_text,
    _item,
    _normalize_items,
    _strip_html,
)

logger = logging.getLogger(__name__)

DDG_INSTANT_URL = "https://api.duckduckgo.com/"
DDG_LITE_URL = "https://lite.duckduckgo.com/lite/"

_LITE_RESULT_RE = re.compile(
    r'<a[^>]+rel="nofollow"[^>]+href="(?P<url>(?:https?:)?//[^"]+)"[^>]*>(?P<title>.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)


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


def _normalize_href(url: str) -> str:
    href = html.unescape((url or "").strip())
    if href.startswith("//"):
        href = "https:" + href
    return unwrap_ddg_redirect(href)


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

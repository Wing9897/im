"""Official Serper Search API (``POST /search``), not HTML scraping."""

from __future__ import annotations

from typing import Any

from server.web_search._common import KeyedSearchSpec, run_keyed_search

SERPER_SEARCH_URL = "https://google.serper.dev/search"


def _serper_headers(key: str) -> dict[str, str]:
    return {"Accept": "application/json", "X-API-KEY": key}


SPEC = KeyedSearchSpec(
    provider="serper",
    url=SERPER_SEARCH_URL,
    method="post",
    url_key="link",
    snippet_key="snippet",
    results_key="organic",
    header_builder=_serper_headers,
    body_builder=lambda _key, query, limit: {"q": query, "num": limit},
)


async def search_serper(query: str, *, api_key: str, count: int | None = None) -> dict[str, Any]:
    """Official Serper Search API (``POST /search``), not HTML scraping."""
    return await run_keyed_search(SPEC, query, api_key=api_key, count=count)

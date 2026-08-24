"""Official Tavily Search (``POST /search``), not crawl / extract / research."""

from __future__ import annotations

from typing import Any

from server.web_search._common import KeyedSearchSpec, _bearer_headers, run_keyed_search

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

SPEC = KeyedSearchSpec(
    provider="tavily",
    url=TAVILY_SEARCH_URL,
    method="post",
    url_key="url",
    snippet_key="content",
    header_builder=_bearer_headers,
    body_builder=lambda key, query, limit: {
        "api_key": key,
        "query": query,
        "max_results": limit,
        "search_depth": "basic",
    },
)


async def search_tavily(query: str, *, api_key: str, count: int | None = None) -> dict[str, Any]:
    """Official Tavily Search (``POST /search``), not crawl / extract / research."""
    return await run_keyed_search(SPEC, query, api_key=api_key, count=count)

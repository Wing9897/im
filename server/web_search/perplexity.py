"""Official Perplexity Search API (``POST /search``), not Sonar chat completions."""

from __future__ import annotations

from typing import Any

from server.web_search._common import KeyedSearchSpec, _bearer_headers, run_keyed_search

PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search"

SPEC = KeyedSearchSpec(
    provider="perplexity",
    url=PERPLEXITY_SEARCH_URL,
    method="post",
    url_key="url",
    snippet_key="snippet",
    header_builder=_bearer_headers,
    body_builder=lambda _key, query, limit: {"query": query, "max_results": limit},
)


async def search_perplexity(query: str, *, api_key: str, count: int | None = None) -> dict[str, Any]:
    """Official Perplexity Search API (``POST /search``), not Sonar chat completions."""
    return await run_keyed_search(SPEC, query, api_key=api_key, count=count)

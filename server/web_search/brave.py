"""Brave Search (``GET /res/v1/web/search``)."""

from __future__ import annotations

from typing import Any

from server.web_search._common import KeyedSearchSpec, run_keyed_search

BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"


def _brave_headers(key: str) -> dict[str, str]:
    return {"Accept": "application/json", "X-Subscription-Token": key}


SPEC = KeyedSearchSpec(
    provider="brave",
    url=BRAVE_SEARCH_URL,
    method="get",
    url_key="url",
    snippet_key="description",
    nested_web=True,
    header_builder=_brave_headers,
    query_builder=lambda query, limit: {"q": query, "count": str(limit)},
)


async def search_brave(query: str, *, api_key: str, count: int | None = None) -> dict[str, Any]:
    return await run_keyed_search(SPEC, query, api_key=api_key, count=count)

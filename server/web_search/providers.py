"""DuckDuckGo (default, no key) plus Brave / Tavily / Perplexity / Serper Search providers.

Public facade over per-engine modules. Callers and tests keep importing from here.
"""

from __future__ import annotations

from typing import Any

import aiohttp

from server.domain.web_search_providers import KEYED_WEB_SEARCH_PROVIDERS
from server.outbound import validate_outbound_url
from server.web_search._common import (
    DEFAULT_COUNT,
    MAX_COUNT,
    KeyedSearchSpec,
    run_keyed_search,
)
from server.web_search.brave import SPEC as _BRAVE_SPEC
from server.web_search.brave import search_brave
from server.web_search.duckduckgo import (
    _normalize_href as _normalize_href,
)
from server.web_search.duckduckgo import (
    search_duckduckgo,
    unwrap_ddg_redirect,
)
from server.web_search.perplexity import SPEC as _PERPLEXITY_SPEC
from server.web_search.perplexity import search_perplexity
from server.web_search.serper import SPEC as _SERPER_SPEC
from server.web_search.serper import search_serper
from server.web_search.tavily import SPEC as _TAVILY_SPEC
from server.web_search.tavily import search_tavily

KEYED_SEARCH_SPECS: tuple[KeyedSearchSpec, ...] = (
    _BRAVE_SPEC,
    _TAVILY_SPEC,
    _PERPLEXITY_SPEC,
    _SERPER_SPEC,
)

if tuple(spec.provider for spec in KEYED_SEARCH_SPECS) != KEYED_WEB_SEARCH_PROVIDERS:
    raise RuntimeError("KEYED_SEARCH_SPECS drifted from KEYED_WEB_SEARCH_PROVIDERS")

_KEYED_SPECS = {spec.provider: spec for spec in KEYED_SEARCH_SPECS}


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
    spec = _KEYED_SPECS.get(name)
    if spec is not None:
        return await run_keyed_search(spec, q, api_key=api_key, count=count)
    if name != "duckduckgo":
        return {
            "error": f"unsupported web_search_provider: {provider}",
            "items": [],
            "provider": name,
            "count": 0,
        }
    return await search_duckduckgo(q, count=count)


__all__ = [
    "DEFAULT_COUNT",
    "KEYED_SEARCH_SPECS",
    "KeyedSearchSpec",
    "MAX_COUNT",
    "aiohttp",
    "search_brave",
    "search_duckduckgo",
    "search_perplexity",
    "search_serper",
    "search_tavily",
    "search_web",
    "unwrap_ddg_redirect",
    "validate_outbound_url",
]

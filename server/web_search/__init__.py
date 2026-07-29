"""Multi-provider web search clients for Agent tools."""

from __future__ import annotations

from server.web_search.providers import (
    DEFAULT_COUNT,
    MAX_COUNT,
    search_brave,
    search_duckduckgo,
    search_web,
    unwrap_ddg_redirect,
)

__all__ = [
    "DEFAULT_COUNT",
    "MAX_COUNT",
    "search_brave",
    "search_duckduckgo",
    "search_web",
    "unwrap_ddg_redirect",
]

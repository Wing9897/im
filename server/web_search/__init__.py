"""Multi-provider web search clients for Agent tools."""

from __future__ import annotations

from server.web_search.execution import (
    ASSISTANT_TOOL_DEFAULT_COUNT,
    WebSearchExecutionService,
)
from server.web_search.providers import (
    DEFAULT_COUNT,
    MAX_COUNT,
    search_brave,
    search_duckduckgo,
    search_perplexity,
    search_serper,
    search_tavily,
    search_web,
    unwrap_ddg_redirect,
)

__all__ = [
    "ASSISTANT_TOOL_DEFAULT_COUNT",
    "DEFAULT_COUNT",
    "MAX_COUNT",
    "WebSearchExecutionService",
    "search_brave",
    "search_duckduckgo",
    "search_perplexity",
    "search_serper",
    "search_tavily",
    "search_web",
    "unwrap_ddg_redirect",
]

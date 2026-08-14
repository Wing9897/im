"""Single source of truth for ``llm_profiles.web_search_provider`` vocabulary.

DDL CHECK in ``server/db/schema_domains/llm.py`` embeds
``WEB_SEARCH_PROVIDER_CHECK_SQL``. Route resolution (auto → native / tool)
lives in ``server.agent.web_search_routing``.
"""

from __future__ import annotations

from typing import Final, Literal

WEB_SEARCH_PROVIDER_AUTO: Final = "auto"
WEB_SEARCH_PROVIDER_DUCKDUCKGO: Final = "duckduckgo"
WEB_SEARCH_PROVIDER_BRAVE: Final = "brave"

WebSearchProviderWire = Literal["auto", "duckduckgo", "brave"]

ALL_WEB_SEARCH_PROVIDERS: Final[tuple[WebSearchProviderWire, ...]] = (
    WEB_SEARCH_PROVIDER_AUTO,
    WEB_SEARCH_PROVIDER_DUCKDUCKGO,
    WEB_SEARCH_PROVIDER_BRAVE,
)

ALLOWED_WEB_SEARCH_PROVIDERS: Final[frozenset[str]] = frozenset(ALL_WEB_SEARCH_PROVIDERS)

WEB_SEARCH_PROVIDER_CHECK_SQL = "CHECK (web_search_provider IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_WEB_SEARCH_PROVIDERS)
)

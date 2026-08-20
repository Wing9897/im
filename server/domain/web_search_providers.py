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
WEB_SEARCH_PROVIDER_TAVILY: Final = "tavily"
WEB_SEARCH_PROVIDER_PERPLEXITY: Final = "perplexity"
WEB_SEARCH_PROVIDER_SERPER: Final = "serper"

WebSearchProviderWire = Literal["auto", "duckduckgo", "brave", "tavily", "perplexity", "serper"]
WebSearchToolProviderWire = Literal["duckduckgo", "brave", "tavily", "perplexity", "serper"]

ALL_WEB_SEARCH_PROVIDERS: Final[tuple[WebSearchProviderWire, ...]] = (
    WEB_SEARCH_PROVIDER_AUTO,
    WEB_SEARCH_PROVIDER_DUCKDUCKGO,
    WEB_SEARCH_PROVIDER_BRAVE,
    WEB_SEARCH_PROVIDER_TAVILY,
    WEB_SEARCH_PROVIDER_PERPLEXITY,
    WEB_SEARCH_PROVIDER_SERPER,
)

TOOL_WEB_SEARCH_PROVIDERS: Final[tuple[WebSearchToolProviderWire, ...]] = (
    WEB_SEARCH_PROVIDER_DUCKDUCKGO,
    WEB_SEARCH_PROVIDER_BRAVE,
    WEB_SEARCH_PROVIDER_TAVILY,
    WEB_SEARCH_PROVIDER_PERPLEXITY,
    WEB_SEARCH_PROVIDER_SERPER,
)

#: Paid tool vendors that store a column-encrypted key on ``llm_profiles``.
#: Keep this tuple in CHECK order (Brave → Tavily → Perplexity → Serper).
KEYED_WEB_SEARCH_PROVIDERS: Final[tuple[WebSearchToolProviderWire, ...]] = (
    WEB_SEARCH_PROVIDER_BRAVE,
    WEB_SEARCH_PROVIDER_TAVILY,
    WEB_SEARCH_PROVIDER_PERPLEXITY,
    WEB_SEARCH_PROVIDER_SERPER,
)

ALLOWED_WEB_SEARCH_PROVIDERS: Final[frozenset[str]] = frozenset(ALL_WEB_SEARCH_PROVIDERS)
ALLOWED_TOOL_WEB_SEARCH_PROVIDERS: Final[frozenset[str]] = frozenset(TOOL_WEB_SEARCH_PROVIDERS)
ALLOWED_KEYED_WEB_SEARCH_PROVIDERS: Final[frozenset[str]] = frozenset(KEYED_WEB_SEARCH_PROVIDERS)

WEB_SEARCH_PROVIDER_CHECK_SQL = "CHECK (web_search_provider IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_WEB_SEARCH_PROVIDERS)
)


def _snake_to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part.capitalize() for part in rest)


#: ``llm_profiles`` ciphertext columns for keyed tool search (matches DDL names).
WEB_SEARCH_SECRET_COLUMNS: Final[tuple[str, ...]] = tuple(
    f"{provider}_search_api_key" for provider in KEYED_WEB_SEARCH_PROVIDERS
)

#: ``(sql_column, wireField)`` pairs — ``brave_search_api_key`` / ``braveSearchApiKey``.
WEB_SEARCH_SECRET_WIRE_FIELDS: Final[tuple[tuple[str, str], ...]] = tuple(
    (column, _snake_to_camel(column)) for column in WEB_SEARCH_SECRET_COLUMNS
)

WEB_SEARCH_SECRET_WIRE_NAMES: Final[tuple[str, ...]] = tuple(wire for _, wire in WEB_SEARCH_SECRET_WIRE_FIELDS)

#: Prompt / tool-schema vendor list (Brave → Tavily → Perplexity → Serper).
KEYED_WEB_SEARCH_PROVIDER_LIST_TEXT: Final = " / ".join(KEYED_WEB_SEARCH_PROVIDERS)


def secret_column_for(provider: str) -> str:
    return f"{provider}_search_api_key"


def secret_provider_from_column(column: str) -> str:
    suffix = "_search_api_key"
    if not column.endswith(suffix):
        raise ValueError(f"not a web-search secret column: {column}")
    return column[: -len(suffix)]


def empty_web_search_api_keys() -> dict[str, str]:
    return dict.fromkeys(KEYED_WEB_SEARCH_PROVIDERS, "")

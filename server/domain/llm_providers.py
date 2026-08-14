"""Single source of truth for ``llm_profiles.provider`` wire vocabulary.

DDL CHECK in ``server/db/schema_domains/llm.py`` embeds
``LLM_PROVIDER_CHECK_SQL`` (asserted equal to ``ALL_LLM_PROVIDERS`` by drift test).
"""

from __future__ import annotations

from typing import Final, Literal

LlmProviderWire = Literal[
    "ollama",
    "openai_compatible",
    "gemini_compatible",
    "openrouter",
]

ALL_LLM_PROVIDERS: Final[tuple[LlmProviderWire, ...]] = (
    "ollama",
    "openai_compatible",
    "gemini_compatible",
    "openrouter",
)

ALLOWED_LLM_PROVIDERS: Final[frozenset[str]] = frozenset(ALL_LLM_PROVIDERS)

LLM_PROVIDER_CHECK_SQL = "CHECK (provider IN ({}))".format(",".join(f"'{value}'" for value in ALL_LLM_PROVIDERS))

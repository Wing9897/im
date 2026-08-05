"""Resolve global and assistant-specific LLM provider configuration."""

from __future__ import annotations

from typing import NotRequired, TypedDict

from server.config import get_config
from server.db.database import Database
from server.util import parse_bool

PROVIDER_ALIASES: dict[str, str] = {
    "ollama": "ollama",
    "openai": "openai",
    "openai_compatible": "openai",
    "gemini": "gemini",
    "gemini_compatible": "gemini",
    "openrouter": "openrouter",
}


class LlmConfig(TypedDict):
    provider: str
    provider_raw: str
    model: str
    api_key: str
    base_url: str
    ollama_thinking_enabled: bool
    timeout: NotRequired[str]


def canonical_provider(raw_provider: str) -> str:
    return PROVIDER_ALIASES.get(raw_provider, raw_provider)


async def _for_raw_provider(db: Database, raw_provider: str) -> LlmConfig:
    canonical = canonical_provider(raw_provider)
    return {
        "provider": canonical,
        "provider_raw": raw_provider,
        "model": await get_config(db, f"{canonical}_model"),
        "api_key": await get_config(db, f"{canonical}_api_key"),
        "base_url": await get_config(db, f"{canonical}_base_url"),
        "ollama_thinking_enabled": parse_bool(await get_config(db, "ollama_thinking_enabled")),
    }


async def load_llm_config(db: Database) -> LlmConfig:
    raw_provider = (await get_config(db, "llm_provider")).strip() or "ollama"
    return await _for_raw_provider(db, raw_provider)


async def load_agent_llm_config(db: Database) -> LlmConfig:
    """Apply assistant override fields, falling back to the selected provider."""
    override = (await get_config(db, "assistant_llm_provider")).strip()
    global_raw = (await get_config(db, "llm_provider")).strip() or "ollama"
    if not override or override.lower() == "follow" or override not in PROVIDER_ALIASES:
        return await _for_raw_provider(db, global_raw)

    config = await _for_raw_provider(db, override)
    assistant_base_url = (await get_config(db, "assistant_llm_base_url")).strip()
    assistant_model = (await get_config(db, "assistant_llm_model")).strip()
    assistant_api_key = (await get_config(db, "assistant_llm_api_key")).strip()
    if assistant_base_url:
        config["base_url"] = assistant_base_url
    if assistant_model:
        config["model"] = assistant_model
    if assistant_api_key:
        config["api_key"] = assistant_api_key
    return config

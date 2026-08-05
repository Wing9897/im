"""Build ``ConfigurableLlmClient`` instances from DB / draft config."""

from __future__ import annotations

from typing import Any

from server.analyzer.llm_config import (
    LlmConfig,
    canonical_provider,
    load_agent_llm_config,
    load_llm_config,
)
from server.config import CONFIG_DEFAULTS, get_config_int
from server.db.database import Database
from server.secrets import MASKED_SECRET


def client_from_resolved_config(cls: Any, config: LlmConfig, timeout_seconds: int) -> Any:
    base_url = config["base_url"]
    if not base_url:
        base_url = CONFIG_DEFAULTS.get(f"{config['provider']}_base_url", "")
    return cls(
        provider=config["provider"],
        model=config["model"],
        api_key=config["api_key"],
        base_url=base_url,
        timeout_seconds=timeout_seconds,
        allow_loopback=config["provider_raw"] in ("ollama", "openai_compatible"),
        ollama_thinking_enabled=config["ollama_thinking_enabled"],
    )


async def client_from_db(cls: Any, db: Database) -> Any:
    config = await load_llm_config(db)
    timeout = await get_config_int(db, "llm_generation_timeout")
    return client_from_resolved_config(cls, config, timeout)


async def client_from_db_for_agent(cls: Any, db: Database) -> Any:
    """Build a client using ``assistant_llm_provider`` (follow / override)."""
    config = await load_agent_llm_config(db)
    timeout = await get_config_int(db, "llm_generation_timeout")
    return client_from_resolved_config(cls, config, timeout)


async def client_from_draft(cls: Any, db: Database, draft: dict[str, Any]) -> Any:
    """Build a one-off client from unsaved UI draft values."""
    saved = await load_llm_config(db)
    raw_provider = str(draft.get("llmProvider") or saved["provider_raw"] or "ollama").strip()
    canonical = canonical_provider(raw_provider)
    base_url = str(draft.get("llmBaseUrl") or saved["base_url"] or "").strip()
    if not base_url:
        base_url = CONFIG_DEFAULTS.get(f"{canonical}_base_url", "")
    model = str(draft.get("llmModel") or saved["model"] or "").strip()
    draft_api_key = draft.get("llmApiKey")
    api_key = str(saved["api_key"] if draft_api_key in (None, MASKED_SECRET) else draft_api_key)
    draft_thinking = draft.get("ollamaThinkingEnabled")
    if draft_thinking is None:
        ollama_thinking_enabled = saved["ollama_thinking_enabled"]
    else:
        ollama_thinking_enabled = bool(draft_thinking)
    timeout = await get_config_int(db, "llm_generation_timeout")
    return cls(
        provider=canonical,
        model=model,
        api_key=api_key,
        base_url=base_url,
        timeout_seconds=timeout,
        allow_loopback=raw_provider in ("ollama", "openai_compatible"),
        ollama_thinking_enabled=ollama_thinking_enabled,
    )

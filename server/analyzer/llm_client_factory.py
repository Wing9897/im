"""Build ``ConfigurableLlmClient`` instances from profile / draft config."""

from __future__ import annotations

from typing import Any

from server.analyzer.llm_config import (
    DEFAULT_PROVIDER_BASE_URLS,
    LlmConfig,
    config_from_draft_fields,
    load_agent_llm_config,
    load_liaison_llm_config,
    load_llm_config,
    load_llm_config_for_profile,
    load_task_editor_llm_config,
)
from server.config import get_config_int
from server.db.database import Database


def client_from_resolved_config(cls: Any, config: LlmConfig, timeout_seconds: int) -> Any:
    base_url = config["base_url"]
    if not base_url:
        base_url = DEFAULT_PROVIDER_BASE_URLS.get(config["provider"], "")
    client = cls(
        provider=config["provider"],
        model=config["model"],
        api_key=config["api_key"],
        base_url=base_url,
        timeout_seconds=timeout_seconds,
        allow_loopback=config["provider_raw"] in ("ollama", "openai_compatible"),
        ollama_thinking_enabled=config["ollama_thinking_enabled"],
    )
    # Stash so runtime_complete / tool ctx re-load the same profile for flags.
    client.profile_id = str(config.get("profile_id") or "")
    return client


async def client_from_assistant_slot(
    cls: Any,
    db: Database,
    *,
    profile_id: str | None = None,
) -> Any:
    """Build a client from the assistant global slot, or an explicit profile override."""
    config = await load_agent_llm_config(db, profile_id=profile_id)
    timeout = await get_config_int(db, "llm_generation_timeout")
    return client_from_resolved_config(cls, config, timeout)


async def client_from_liaison_slot(cls: Any, db: Database) -> Any:
    """Build a client from the A2A / account-manager global slot."""
    config = await load_liaison_llm_config(db)
    timeout = await get_config_int(db, "llm_generation_timeout")
    return client_from_resolved_config(cls, config, timeout)


async def client_from_task_editor_slot(cls: Any, db: Database) -> Any:
    """Build a client from the task-advisor global slot."""
    config = await load_task_editor_llm_config(db)
    timeout = await get_config_int(db, "llm_generation_timeout")
    return client_from_resolved_config(cls, config, timeout)


async def client_from_profile(cls: Any, db: Database, profile_id: str | None) -> Any:
    config = await load_llm_config_for_profile(db, profile_id)
    timeout = await get_config_int(db, "llm_generation_timeout")
    return client_from_resolved_config(cls, config, timeout)


async def client_from_draft(cls: Any, db: Database, draft: dict[str, Any]) -> Any:
    """Build a one-off client from unsaved profile-card draft values."""
    profile_id = draft.get("llmProfileId") or draft.get("id")
    fallback: LlmConfig | None = None
    if profile_id:
        try:
            fallback = await load_llm_config_for_profile(db, str(profile_id))
        except Exception:  # noqa: BLE001 — draft may reference a not-yet-saved id
            fallback = await load_llm_config(db)
    else:
        fallback = await load_llm_config(db)
    config = config_from_draft_fields(draft, fallback=fallback)
    timeout = await get_config_int(db, "llm_generation_timeout")
    return client_from_resolved_config(cls, config, timeout)

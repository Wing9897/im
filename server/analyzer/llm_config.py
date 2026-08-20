"""Resolve LLM connection settings from ``llm_profiles`` rows."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict

from server.db.database import Database
from server.domain.llm_providers import ALL_LLM_PROVIDERS, ALLOWED_LLM_PROVIDERS
from server.domain.web_search_providers import WEB_SEARCH_SECRET_COLUMNS, WEB_SEARCH_SECRET_WIRE_FIELDS
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.secrets import MASKED_SECRET, unprotect_text
from server.util import parse_bool

#: Runtime wire → handler id (short ``openai``／``gemini`` stay rejected on write).
PROVIDER_ALIASES: dict[str, str] = {
    "openai_compatible": "openai",
    "gemini_compatible": "gemini",
}

WIRE_PROVIDERS = frozenset(ALL_LLM_PROVIDERS)
assert WIRE_PROVIDERS == ALLOWED_LLM_PROVIDERS

#: Fallback base URLs when a profile leaves ``base_url`` empty.
DEFAULT_PROVIDER_BASE_URLS: dict[str, str] = {
    "ollama": "http://localhost:11434",
    "openai": "https://api.openai.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
    "openrouter": "https://openrouter.ai/api/v1",
}


class LlmConfig(TypedDict):
    provider: str
    provider_raw: str
    model: str
    api_key: str
    base_url: str
    ollama_thinking_enabled: bool
    json_mode: str
    web_search_enabled: bool
    web_search_provider: str
    brave_search_api_key: str
    tavily_search_api_key: str
    perplexity_search_api_key: str
    serper_search_api_key: str
    profile_id: str
    timeout: NotRequired[str]


def canonical_provider(raw_provider: str) -> str:
    return PROVIDER_ALIASES.get(raw_provider, raw_provider)


def normalize_wire_provider(raw: str | None) -> str:
    """Normalize stored / draft wire provider ids.

    Accepts only ``WIRE_PROVIDERS`` values. Short ids ``openai``／``gemini`` are
    not accepted on write paths (canonical map stays in ``PROVIDER_ALIASES`` for
    runtime ``canonical_provider``).

    Unknown values raise instead of silently coercing to ``ollama``: wire
    bodies are Literal-typed (422 upstream) and stored rows are gated by
    ``profile_incompleteness_reason``, so reaching this raise means a corrupted
    row or a programming error — fail hard rather than run the wrong provider.
    """
    value = (raw or "").strip()
    if value in WIRE_PROVIDERS:
        return value
    raise ValueError(f"Unknown LLM provider: {value or '(empty)'}")


def _config_from_profile_row(row: Mapping[str, Any]) -> LlmConfig:
    raw_provider = normalize_wire_provider(str(row.get("provider") or "ollama"))
    canonical = canonical_provider(raw_provider)
    base_url = str(row.get("base_url") or "").strip()
    if not base_url:
        base_url = DEFAULT_PROVIDER_BASE_URLS.get(canonical, "")
    api_key = unprotect_text(row.get("api_key") or "")
    search_keys = {column: unprotect_text(row.get(column) or "") for column in WEB_SEARCH_SECRET_COLUMNS}
    return {
        "provider": canonical,
        "provider_raw": raw_provider,
        "model": str(row.get("model") or "").strip(),
        "api_key": api_key,
        "base_url": base_url,
        "ollama_thinking_enabled": bool(int(row.get("thinking_enabled") or 0)),
        "json_mode": str(row.get("json_mode") or "disabled"),
        "web_search_enabled": bool(int(row.get("web_search_enabled") or 0)),
        "web_search_provider": str(row.get("web_search_provider") or "auto"),
        **search_keys,
        "profile_id": str(row["id"]),
    }


async def fetch_first_profile_id(db: Database) -> str:
    """Return the oldest profile id, or raise when none exist.

    Used only as a task-create convenience when ``llmProfileId`` is omitted.
    Never invents a fake ``__default__`` id.
    """
    row = await db.fetch_one("SELECT id FROM llm_profiles ORDER BY created_at ASC LIMIT 1")
    if row is not None:
        return str(row["id"])
    raise http_error(
        400,
        "No LLM profile configured; create an AI profile first",
        error_code=VALIDATION_ERROR,
    )


async def require_complete_profile_row(db: Database, profile_id: str) -> Mapping[str, Any]:
    """Load a profile row and reject missing / incomplete configurations."""
    from server.analyzer.llm_profile_completeness import profile_incompleteness_reason

    resolved_id = (profile_id or "").strip()
    if not resolved_id:
        raise http_error(
            400,
            "llmProfileId is required; create an AI profile first",
            error_code=VALIDATION_ERROR,
        )
    row = await db.fetch_one("SELECT * FROM llm_profiles WHERE id = ?", (resolved_id,))
    if row is None:
        raise http_error(404, f"LLM profile not found: {resolved_id}", error_code=NOT_FOUND)
    reason = profile_incompleteness_reason(row)
    if reason is not None:
        raise http_error(400, reason, error_code=VALIDATION_ERROR)
    return row


async def load_llm_config_for_profile(db: Database, profile_id: str | None) -> LlmConfig:
    """Sole connection entry: resolve a profile row into runtime LLM config."""
    resolved_id = (profile_id or "").strip() or await fetch_first_profile_id(db)
    row = await require_complete_profile_row(db, resolved_id)
    return _config_from_profile_row(row)


async def load_llm_config(db: Database) -> LlmConfig:
    """Load the oldest profile (health / status / draft fallback)."""
    return await load_llm_config_for_profile(db, None)


async def load_agent_llm_config(
    db: Database,
    *,
    profile_id: str | None = None,
) -> LlmConfig:
    """Assistant chat path: session profile → hard-bound assistant global slot.

    When ``profile_id`` is set (per-session override from the UI), load that
    complete profile directly. Otherwise require the singleton assistant slot
    (``llm_global_slot_assistant``), same hard-bind as liaison. Never invent a
    fake ``__default__`` id when empty.

    A2A must use :func:`load_liaison_llm_config` (separate global slot).
    """
    from server.llm_global_slots import require_slot_profile_id

    override = (profile_id or "").strip()
    if override:
        return await load_llm_config_for_profile(db, override)

    slot_profile_id = await require_slot_profile_id(db, "assistant")
    return await load_llm_config_for_profile(db, slot_profile_id)


async def load_liaison_llm_config(db: Database) -> LlmConfig:
    """A2A / account manager: dedicated global ``liaison`` slot (no assistant borrow)."""
    from server.llm_global_slots import require_slot_profile_id

    profile_id = await require_slot_profile_id(db, "liaison")
    return await load_llm_config_for_profile(db, profile_id)


async def load_task_editor_llm_config(db: Database) -> LlmConfig:
    """Task advisor: dedicated global ``taskEditor`` slot."""
    from server.llm_global_slots import require_slot_profile_id

    profile_id = await require_slot_profile_id(db, "taskEditor")
    return await load_llm_config_for_profile(db, profile_id)


async def load_llm_config_for_task(db: Database, task: Mapping[str, Any]) -> LlmConfig:
    profile_id = str(task.get("llm_profile_id") or "").strip() or None
    if not profile_id:
        raise http_error(
            400,
            "Task has no llmProfileId; assign a complete AI profile first",
            error_code=VALIDATION_ERROR,
        )
    return await load_llm_config_for_profile(db, profile_id)


def config_from_draft_fields(draft: Mapping[str, Any], *, fallback: LlmConfig | None = None) -> LlmConfig:
    """Build config from unsaved profile-shaped draft fields (AI engine test).

    Accepts the same profile-card vocabulary as ``LlmProfileUpsertBody`` /
    ``AiEngineTestBody`` (``provider``／``baseUrl``／``model``／``apiKey``／
    ``thinkingEnabled``／…).
    """
    base = fallback or {
        "provider": "ollama",
        "provider_raw": "ollama",
        "model": "",
        "api_key": "",
        "base_url": DEFAULT_PROVIDER_BASE_URLS["ollama"],
        "ollama_thinking_enabled": False,
        "json_mode": "disabled",
        "web_search_enabled": True,
        "web_search_provider": "auto",
        "brave_search_api_key": "",
        "tavily_search_api_key": "",
        "perplexity_search_api_key": "",
        "serper_search_api_key": "",
        "profile_id": "",
    }
    raw_provider = normalize_wire_provider(str(draft.get("provider") or base["provider_raw"]))
    canonical = canonical_provider(raw_provider)
    base_url = str(draft.get("baseUrl") or base["base_url"] or "").strip()
    if not base_url:
        base_url = DEFAULT_PROVIDER_BASE_URLS.get(canonical, "")
    model = str(draft.get("model") or base["model"] or "").strip()
    draft_api_key = draft.get("apiKey")
    api_key = base["api_key"] if draft_api_key in (None, MASKED_SECRET) else str(draft_api_key)
    thinking = draft.get("thinkingEnabled")
    if thinking is None:
        ollama_thinking_enabled = base["ollama_thinking_enabled"]
    else:
        ollama_thinking_enabled = bool(thinking) if not isinstance(thinking, str) else parse_bool(thinking)
    json_mode = str(draft.get("jsonMode") or base["json_mode"] or "disabled")
    web_enabled = draft.get("webSearchEnabled")
    if web_enabled is None:
        web_search_enabled = base["web_search_enabled"]
    else:
        web_search_enabled = bool(web_enabled) if not isinstance(web_enabled, str) else parse_bool(web_enabled)
    web_provider = str(draft.get("webSearchProvider") or base["web_search_provider"] or "auto")
    search_keys = {}
    for column, wire in WEB_SEARCH_SECRET_WIRE_FIELDS:
        draft_value = draft.get(wire)
        search_keys[column] = (
            str(base.get(column) or "") if draft_value in (None, MASKED_SECRET) else str(draft_value)
        )
    return {
        "provider": canonical,
        "provider_raw": raw_provider,
        "model": model,
        "api_key": api_key,
        "base_url": base_url,
        "ollama_thinking_enabled": ollama_thinking_enabled,
        "json_mode": json_mode,
        "web_search_enabled": web_search_enabled,
        "web_search_provider": web_provider,
        "brave_search_api_key": search_keys["brave_search_api_key"],
        "tavily_search_api_key": search_keys["tavily_search_api_key"],
        "perplexity_search_api_key": search_keys["perplexity_search_api_key"],
        "serper_search_api_key": search_keys["serper_search_api_key"],
        "profile_id": str(draft.get("llmProfileId") or draft.get("id") or base.get("profile_id") or ""),
    }

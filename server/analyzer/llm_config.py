"""Resolve LLM connection settings from ``llm_profiles`` rows."""

from __future__ import annotations

from typing import Any, Mapping, NotRequired, TypedDict

from server.db.database import Database
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.secrets import MASKED_SECRET, unprotect_text
from server.util import parse_bool

PROVIDER_ALIASES: dict[str, str] = {
    "ollama": "ollama",
    "openai": "openai",
    "openai_compatible": "openai",
    "gemini": "gemini",
    "gemini_compatible": "gemini",
    "openrouter": "openrouter",
}

WIRE_PROVIDERS = frozenset({"ollama", "openai_compatible", "gemini_compatible", "openrouter"})

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
    profile_id: str
    timeout: NotRequired[str]


def canonical_provider(raw_provider: str) -> str:
    return PROVIDER_ALIASES.get(raw_provider, raw_provider)


def normalize_wire_provider(raw: str | None) -> str:
    value = (raw or "").strip()
    if value in WIRE_PROVIDERS:
        return value
    if value in PROVIDER_ALIASES:
        # Map legacy short ids to wire ids used in profiles.
        if value == "openai":
            return "openai_compatible"
        if value == "gemini":
            return "gemini_compatible"
        return value
    return "ollama"


def _config_from_profile_row(row: Mapping[str, Any]) -> LlmConfig:
    raw_provider = normalize_wire_provider(str(row.get("provider") or "ollama"))
    canonical = canonical_provider(raw_provider)
    base_url = str(row.get("base_url") or "").strip()
    if not base_url:
        base_url = DEFAULT_PROVIDER_BASE_URLS.get(canonical, "")
    api_key = unprotect_text(row.get("api_key") or "")
    brave_key = unprotect_text(row.get("brave_search_api_key") or "")
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
        "brave_search_api_key": brave_key,
        "profile_id": str(row["id"]),
    }


async def fetch_default_profile_id(db: Database) -> str:
    """Return the ``is_default`` profile id, or raise when none is configured."""
    row = await db.fetch_one("SELECT id FROM llm_profiles WHERE is_default = 1 LIMIT 1")
    if row is not None:
        return str(row["id"])
    raise http_error(
        400,
        "No default LLM profile configured; create an AI profile first",
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
    resolved_id = (profile_id or "").strip() or await fetch_default_profile_id(db)
    row = await require_complete_profile_row(db, resolved_id)
    return _config_from_profile_row(row)


async def load_llm_config(db: Database) -> LlmConfig:
    """Load the default profile (health / status / assistant fallback)."""
    return await load_llm_config_for_profile(db, None)


async def load_agent_llm_config(
    db: Database,
    *,
    profile_id: str | None = None,
) -> LlmConfig:
    """Assistant / A2A: resolve LLM config for the agent chat path.

    When ``profile_id`` is set (per-session override from the UI), load that
    complete profile directly. Otherwise resolve via ``staff_class=assistant``
    → ``profile_id``, preferring an active assistant staff instance. Fall back
    to the default profile when no assistant instance exists. Never invent a
    fake ``__default__`` id when the table is empty.

    A2A is sessionless and must call without ``profile_id`` (staff / default).
    """
    override = (profile_id or "").strip()
    if override:
        return await load_llm_config_for_profile(db, override)

    staff = await db.fetch_one(
        "SELECT profile_id FROM llm_staff_instances "
        "WHERE staff_class = 'assistant' AND is_active = 1 "
        "ORDER BY updated_at DESC LIMIT 1",
    )
    if staff is None:
        staff = await db.fetch_one(
            "SELECT profile_id FROM llm_staff_instances "
            "WHERE staff_class = 'assistant' "
            "ORDER BY updated_at DESC LIMIT 1",
        )
    if staff is not None:
        return await load_llm_config_for_profile(db, str(staff["profile_id"]))
    count = await db.fetch_value("SELECT COUNT(*) FROM llm_profiles")
    if int(count or 0) == 0:
        raise http_error(
            400,
            "No usable assistant LLM profile; create an AI profile and bind the assistant staff class",
            error_code=VALIDATION_ERROR,
        )
    return await load_llm_config_for_profile(db, None)


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
    """Build config from unsaved UI draft fields (profile card test)."""
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
        "profile_id": "",
    }
    raw_provider = normalize_wire_provider(
        str(draft.get("llmProvider") or draft.get("provider") or base["provider_raw"])
    )
    canonical = canonical_provider(raw_provider)
    base_url = str(draft.get("llmBaseUrl") or draft.get("baseUrl") or base["base_url"] or "").strip()
    if not base_url:
        base_url = DEFAULT_PROVIDER_BASE_URLS.get(canonical, "")
    model = str(draft.get("llmModel") or draft.get("model") or base["model"] or "").strip()
    draft_api_key = draft.get("llmApiKey") if "llmApiKey" in draft else draft.get("apiKey")
    if draft_api_key in (None, MASKED_SECRET):
        api_key = base["api_key"]
    else:
        api_key = str(draft_api_key)
    thinking = draft.get("ollamaThinkingEnabled")
    if thinking is None:
        thinking = draft.get("thinkingEnabled")
    if thinking is None:
        ollama_thinking_enabled = base["ollama_thinking_enabled"]
    else:
        ollama_thinking_enabled = bool(thinking) if not isinstance(thinking, str) else parse_bool(thinking)
    json_mode = str(draft.get("jsonMode") or draft.get("openaiJsonMode") or base["json_mode"] or "disabled")
    web_enabled = draft.get("webSearchEnabled")
    if web_enabled is None:
        web_search_enabled = base["web_search_enabled"]
    else:
        web_search_enabled = bool(web_enabled) if not isinstance(web_enabled, str) else parse_bool(web_enabled)
    web_provider = str(draft.get("webSearchProvider") or base["web_search_provider"] or "auto")
    draft_brave = draft.get("braveSearchApiKey")
    if draft_brave in (None, MASKED_SECRET):
        brave_key = base["brave_search_api_key"]
    else:
        brave_key = str(draft_brave)
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
        "brave_search_api_key": brave_key,
        "profile_id": str(draft.get("id") or base.get("profile_id") or ""),
    }

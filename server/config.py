"""system_config access with the authoritative default key set.

Key list matches ``CONFIG_DEFAULTS`` in this module.
"""

from __future__ import annotations

from typing import Optional

from server.db.database import Database
from server.secrets import SECRET_CONFIG_KEYS, protect_text, unprotect_text
from server.util import parse_bool, utc_now_iso

#: Authoritative defaults. A key absent from the table falls back to this map.
CONFIG_DEFAULTS: dict[str, str] = {
    "llm_provider": "ollama",
    "analysis_paused": "false",
    "ollama_base_url": "http://localhost:11434",
    "ollama_model": "",
    "ollama_thinking_enabled": "false",
    "openai_base_url": "https://api.openai.com/v1",
    "openai_model": "",
    "openai_api_key": "",
    "openai_json_mode": "disabled",
    "gemini_base_url": "https://generativelanguage.googleapis.com/v1beta",
    "gemini_model": "",
    "gemini_api_key": "",
    "openrouter_base_url": "https://openrouter.ai/api/v1",
    "openrouter_model": "",
    "openrouter_api_key": "",
    "analysis_batch_message_limit": "50",
    "analysis_max_total_chars": "100000",
    "analysis_max_estimated_input_tokens": "30000",
    "analysis_trace_verbose": "false",
    "llm_generation_timeout": "120",
    "max_batch_retries": "3",
    "max_concurrent_batches": "2",
    "intelligence_rules_version": "v2",
    "analysis_strategy_mode": "balanced",
    "analysis_trigger_threshold": "50",
    "localhost_auth_exempt": "true",
    # Set true on first successful register / password login.
    "setup_complete": "false",
    "retention_messages_days": "90",
    "retention_analysis_days": "90",
    "retention_leaderboard_days": "90",
    "retention_app_logs_days": "30",
    "retention_user_events_days": "365",
    "auto_pause_on_retries_exhausted": "true",
    # "system" resolves the renderer's OS timezone to a nearby city for weather.
    "weather_location": "system",
    # UI / AI output language (zh-Hant | zh-Hans | en). Client localStorage is
    # the live UI source of truth; this copy drives background analysis.
    "ui_locale": "zh-Hant",
    # Assistant web search (Agent tool web.search). DuckDuckGo needs no API key.
    "assistant_web_search_enabled": "true",
    "web_search_provider": "duckduckgo",
    "brave_search_api_key": "",
    # Agent LLM: empty / "follow" = use llm_provider; else a provider id.
    # Non-empty assistant_llm_{base_url,model,api_key} override that provider's
    # global {prefix}_* keys; empty fields fall back to the provider prefix.
    "assistant_llm_provider": "",
    "assistant_llm_base_url": "",
    "assistant_llm_model": "",
    "assistant_llm_api_key": "",
    # Agent-only model-facing history caps (UI sessions keep full transcript).
    "agent_history_max_messages": "40",
    "agent_history_max_chars": "48000",
    # Project-manager Agent ticks (closed-loop); assistant stays at runtime default 8.
    "agent_project_max_tool_rounds": "28",
    # Max message-drain waves per project schedule fire (40 msgs/wave). 0 = unlimited.
    "agent_project_max_drain_waves": "0",
    # Assistant display identity (UI); empty name → client i18n default.
    "assistant_display_name": "",
    # JPEG/PNG data URL (capped on write); empty → built-in avatar asset.
    "assistant_avatar": "",
    # User profile (UI); empty name → client i18n / placeholder.
    "user_display_name": "",
    # JPEG/PNG data URL (capped on write); empty → default user icon.
    "user_avatar": "",
    # Free-text background / bio for future AI context; empty = unset.
    "user_background": "",
    # UI prefs JSON blobs retired from system_config (schema v15 → ui_prefs table).
    # assistant_sessions retired earlier (schema v10 → assistant_device_stores).
}

#: Value clamping ranges for integer keys (min, max). None = unbounded side.
_INT_RANGES: dict[str, tuple[int, Optional[int]]] = {
    "analysis_batch_message_limit": (1, 500),
    "analysis_max_total_chars": (500, 200000),
    "analysis_max_estimated_input_tokens": (500, 100000),
    "llm_generation_timeout": (30, 1800),
    "max_batch_retries": (1, 10),
    "max_concurrent_batches": (1, 10),
    "analysis_trigger_threshold": (1, 500),
    "agent_history_max_messages": (4, 200),
    "agent_history_max_chars": (2000, 200000),
    "agent_project_max_tool_rounds": (8, 64),
    "agent_project_max_drain_waves": (0, 200),
    "retention_messages_days": (0, None),
    "retention_analysis_days": (0, None),
    "retention_leaderboard_days": (0, None),
    "retention_app_logs_days": (0, None),
    "retention_user_events_days": (0, None),
}


async def get_config(db: Database, key: str) -> str:
    """Read a config value, falling back to the authoritative default ('' if unknown)."""
    row = await db.fetch_one("SELECT value FROM system_config WHERE key = ?", (key,))
    if row is not None:
        raw = str(row["value"])
        return unprotect_text(raw) if key in SECRET_CONFIG_KEYS else raw
    return CONFIG_DEFAULTS.get(key, "")


async def get_config_int(db: Database, key: str) -> int:
    """Read an integer config value, clamped to its allowed range."""
    raw = await get_config(db, key)
    try:
        value = int(float(raw))
    except (TypeError, ValueError):
        value = int(CONFIG_DEFAULTS.get(key, "0") or "0")
    low, high = _INT_RANGES.get(key, (None, None))
    if low is not None:
        value = max(low, value)
    if high is not None:
        value = min(high, value)
    return value


async def get_config_bool(db: Database, key: str) -> bool:
    return parse_bool(await get_config(db, key))


async def get_auto_pause_on_retries_exhausted(db: Database) -> bool:
    """Read auto-pause-on-retries-exhausted from system_config."""
    return await get_config_bool(db, "auto_pause_on_retries_exhausted")


async def set_configs(db: Database, updates: dict[str, str]) -> None:
    now = utc_now_iso()
    rows = [
        (
            key,
            protect_text(str(value)) if key in SECRET_CONFIG_KEYS else str(value),
            now,
        )
        for key, value in updates.items()
    ]
    await db.execute_many(
        "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, "
        "updated_at = excluded.updated_at",
        rows,
    )

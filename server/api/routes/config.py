"""Config routes: settings snapshot.

``SystemSettingsSnapshot`` (web/src/types/settings.ts) is camelCase on the
wire and maps 1:1 onto snake_case ``system_config`` keys. Numeric values
travel as strings; ``analysisPaused`` / ``analysisTraceVerbose`` as booleans.

LLM connection settings live under ``/api/v1/llm/profiles``.
Household API access keys live under ``/api/v1/access-keys`` (not here).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.deps import API_DEPS, get_db
from server.api.schemas.requests import SystemSettingsUpdateBody
from server.api.schemas.responses import SystemSettingsSnapshot
from server.config import (
    get_auto_pause_on_retries_exhausted,
    get_config,
    set_configs,
)
from server.domain.mcp_capabilities import (
    MCP_CAPABILITY_SETTINGS_KEYS,
    MCP_CAPABILITY_WIRE_KEYS,
)
from server.errors import VALIDATION_ERROR, http_error
from server.prompts.locale import normalize_ui_locale
from server.secrets import MASKED_SECRET, SECRET_CONFIG_KEYS
from server.util import parse_bool

router = APIRouter(prefix="/api/v1/config", tags=["config"], dependencies=API_DEPS)

#: camelCase wire key -> system_config key.
#: MCP capability toggles derive from ``MCP_CAPABILITY_SETTINGS_KEYS``.
_SETTINGS_KEYS: dict[str, str] = {
    "analysisPaused": "analysis_paused",
    "analysisBatchMessageLimit": "analysis_batch_message_limit",
    "analysisMaxTotalChars": "analysis_max_total_chars",
    "analysisMaxEstimatedInputTokens": "analysis_max_estimated_input_tokens",
    "analysisTraceVerbose": "analysis_trace_verbose",
    "llmGenerationTimeout": "llm_generation_timeout",
    "maxBatchRetries": "max_batch_retries",
    "maxConcurrentBatches": "max_concurrent_batches",
    "analysisStrategyMode": "analysis_strategy_mode",
    "analysisTriggerThreshold": "analysis_trigger_threshold",
    "retentionMessagesDays": "retention_messages_days",
    "retentionAnalysisDays": "retention_analysis_days",
    "retentionLeaderboardDays": "retention_leaderboard_days",
    "retentionAppLogsDays": "retention_app_logs_days",
    "retentionUserEventsDays": "retention_user_events_days",
    "autoPauseOnRetriesExhausted": "auto_pause_on_retries_exhausted",
    "weatherLocation": "weather_location",
    "uiLocale": "ui_locale",
    "agentHistoryMaxMessages": "agent_history_max_messages",
    "agentHistoryMaxChars": "agent_history_max_chars",
    "assistantDisplayName": "assistant_display_name",
    "assistantAvatar": "assistant_avatar",
    "userDisplayName": "user_display_name",
    "userAvatar": "user_avatar",
    "userBackground": "user_background",
    "mcpEnabled": "mcp_enabled",
    "a2aEnabled": "a2a_enabled",
    **MCP_CAPABILITY_SETTINGS_KEYS,
}

#: Match web ``AVATAR_MAX_DATA_URL_CHARS`` / display-name field limits.
_ASSISTANT_DISPLAY_NAME_MAX = 64
_ASSISTANT_AVATAR_MAX_CHARS = 200 * 1024
_USER_DISPLAY_NAME_MAX = 64
_USER_AVATAR_MAX_CHARS = 200 * 1024
_USER_BACKGROUND_MAX = 2000

_BOOL_KEYS = {
    "analysisPaused",
    "analysisTraceVerbose",
    "autoPauseOnRetriesExhausted",
    "mcpEnabled",
    "a2aEnabled",
    *MCP_CAPABILITY_WIRE_KEYS,
}

_SECRET_WIRE_KEYS = {wire_key for wire_key, config_key in _SETTINGS_KEYS.items() if config_key in SECRET_CONFIG_KEYS}

# Read-only on PUT /settings — analysisPaused: POST /system/analysis/pause.
_READ_ONLY_WRITE_KEYS = frozenset({"analysisPaused"})

# Update body must stay an all-optional mirror of the snapshot model.
assert set(SystemSettingsUpdateBody.model_fields) == set(SystemSettingsSnapshot.model_fields)


async def _settings_snapshot(db: Any) -> SystemSettingsSnapshot:
    snapshot: dict[str, Any] = {}
    for wire_key, config_key in _SETTINGS_KEYS.items():
        if wire_key == "autoPauseOnRetriesExhausted":
            snapshot[wire_key] = await get_auto_pause_on_retries_exhausted(db)
            continue
        raw = await get_config(db, config_key)
        if wire_key in _SECRET_WIRE_KEYS:
            snapshot[wire_key] = MASKED_SECRET if raw else ""
        else:
            snapshot[wire_key] = parse_bool(raw) if wire_key in _BOOL_KEYS else raw
    return SystemSettingsSnapshot.model_validate(snapshot)


@router.get("/settings", response_model=SystemSettingsSnapshot)
async def fetch_settings(request: Request) -> SystemSettingsSnapshot:
    return await _settings_snapshot(get_db(request))


def _validated_avatar(wire_key: str, value: Any, max_chars: int) -> str:
    """Empty clears; otherwise require a bounded ``data:image/`` URL (422)."""
    avatar = "" if value is None else str(value).strip()
    if not avatar:
        return ""
    if not avatar.startswith("data:image/") or len(avatar) > max_chars:
        raise http_error(
            422,
            f"Invalid {wire_key}: must be a data:image/ URL of at most {max_chars} chars",
            error_code=VALIDATION_ERROR,
        )
    return avatar


def _validated_max_concurrent_batches(value: Any) -> str:
    text = ("" if value is None else str(value)).strip()
    try:
        int(text)
    except ValueError:
        raise http_error(
            422,
            "Invalid maxConcurrentBatches: must be an integer",
            error_code=VALIDATION_ERROR,
        ) from None
    return text


@router.put("/settings", response_model=SystemSettingsSnapshot)
async def save_settings(request: Request, body: SystemSettingsUpdateBody) -> SystemSettingsSnapshot:
    """Partial PUT: known ``SystemSettingsSnapshot`` keys only; unknown → 422 (extra=forbid)."""
    provided = body.model_dump(exclude_unset=True)
    db = get_db(request)
    updates: dict[str, str] = {}
    for wire_key, config_key in _SETTINGS_KEYS.items():
        if wire_key not in provided or wire_key in _READ_ONLY_WRITE_KEYS:
            continue
        value = provided[wire_key]
        if wire_key in _SECRET_WIRE_KEYS and value == MASKED_SECRET:
            continue
        if wire_key in _BOOL_KEYS:
            updates[config_key] = "true" if value else "false"
        elif config_key == "ui_locale":
            updates[config_key] = normalize_ui_locale("" if value is None else str(value))
        elif config_key == "max_concurrent_batches":
            updates[config_key] = _validated_max_concurrent_batches(value)
        elif config_key == "assistant_display_name":
            name = ("" if value is None else str(value)).strip()
            updates[config_key] = name[:_ASSISTANT_DISPLAY_NAME_MAX]
        elif config_key == "assistant_avatar":
            updates[config_key] = _validated_avatar(wire_key, value, _ASSISTANT_AVATAR_MAX_CHARS)
        elif config_key == "user_display_name":
            name = ("" if value is None else str(value)).strip()
            updates[config_key] = name[:_USER_DISPLAY_NAME_MAX]
        elif config_key == "user_avatar":
            updates[config_key] = _validated_avatar(wire_key, value, _USER_AVATAR_MAX_CHARS)
        elif config_key == "user_background":
            text = "" if value is None else str(value)
            updates[config_key] = text[:_USER_BACKGROUND_MAX]
        else:
            updates[config_key] = "" if value is None else str(value)
    if updates:
        await set_configs(db, updates)

    # Apply hot-swappable runtime knobs immediately (already validated above).
    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler is not None and "max_concurrent_batches" in updates:
        await scheduler.update_concurrency_limit(int(updates["max_concurrent_batches"]))
    return await _settings_snapshot(db)

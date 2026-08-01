"""Encryption and API masking for automation action configuration."""

from __future__ import annotations

import json
from typing import Any

from server.secrets import MASKED_SECRET, protect_text, unprotect_text

_SENSITIVE_FIELDS: dict[str, frozenset[str]] = {
    "telegram_bot": frozenset({"bot_token"}),
    "discord_webhook": frozenset({"webhook_url"}),
    "http_webhook": frozenset({"url"}),
    "mqtt": frozenset({"password"}),
}


def _parse_configuration(value: Any) -> dict[str, Any]:
    try:
        parsed = json.loads(unprotect_text(value))
    except (json.JSONDecodeError, TypeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _dump_configuration(config: dict[str, Any]) -> str:
    return json.dumps(config, ensure_ascii=False, separators=(",", ":"))


def protect_action_configuration(value: str) -> str:
    """Encrypt the full JSON configuration string for database storage."""
    return protect_text(value)


def action_configuration_for_execution(value: Any) -> dict[str, Any]:
    """Return decrypted configuration for the action executor."""
    return _parse_configuration(value)


def masked_action_configuration(value: Any, action_type: str) -> str:
    """Return configuration JSON with credentials replaced by the shared mask."""
    config = _parse_configuration(value)
    for key in _SENSITIVE_FIELDS.get(action_type, frozenset()):
        if config.get(key):
            config[key] = MASKED_SECRET
    if action_type == "http_webhook" and isinstance(config.get("headers"), dict):
        config["headers"] = {
            str(key): MASKED_SECRET if header_value else "" for key, header_value in config["headers"].items()
        }
    return _dump_configuration(config)


def merge_masked_action_configuration(incoming: str, existing: Any, action_type: str) -> str:
    """Preserve stored credentials when an edit form submits masked placeholders."""
    next_config = _parse_configuration(incoming)
    previous = _parse_configuration(existing)
    for key in _SENSITIVE_FIELDS.get(action_type, frozenset()):
        if next_config.get(key) == MASKED_SECRET and key in previous:
            next_config[key] = previous[key]
    if action_type == "http_webhook" and isinstance(next_config.get("headers"), dict):
        previous_headers = previous.get("headers")
        previous_headers = previous_headers if isinstance(previous_headers, dict) else {}
        next_config["headers"] = {
            str(key): previous_headers.get(key, value) if value == MASKED_SECRET else value
            for key, value in next_config["headers"].items()
        }
    return _dump_configuration(next_config)

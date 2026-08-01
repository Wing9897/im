"""Small shared helpers."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping
from urllib.parse import urlparse


def utc_now_iso() -> str:
    """Current UTC time as ISO 8601 with a trailing Z (second precision)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_id() -> str:
    """Server-generated TEXT primary key."""
    return uuid.uuid4().hex


def parse_json_dict(raw: Any) -> dict[str, Any]:
    """Lenient JSON-dict parse: dict passthrough, anything invalid -> {}."""
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def parse_json_list(raw: Any) -> list[Any]:
    """Lenient JSON-list parse: list passthrough, anything invalid -> []."""
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def parse_bool(raw: str) -> bool:
    """Canonical config-string truthiness: 1/true/yes/on (case-insensitive)."""
    return raw.strip().lower() in ("1", "true", "yes", "on")


def is_openai_json_mode_enabled(raw: str) -> bool:
    """True unless ``openai_json_mode`` is empty or a disabled sentinel."""
    return raw.strip().lower() not in ("", "disabled", "off", "false", "0")


def task_value(task: Mapping[str, Any] | Any, key: str) -> Any:
    """Read a field from a task given either a mapping row or an object."""
    if isinstance(task, Mapping):
        return task.get(key)
    return getattr(task, key, None)


def parse_mqtt_url(broker_url: str) -> tuple[str, int]:
    """Parse an MQTT broker URL into (hostname, port); port defaults to 1883.

    Accepts ``mqtt://host[:port]``, ``tcp://host[:port]`` or bare
    ``host[:port]``. An empty hostname is returned as "" for callers to
    reject.
    """
    text = (broker_url or "").strip()
    if "//" not in text:
        text = "mqtt://" + text
    try:
        parsed = urlparse(text)
        host = parsed.hostname or ""
        port = parsed.port or 1883
    except ValueError:
        return "", 1883
    return host, port

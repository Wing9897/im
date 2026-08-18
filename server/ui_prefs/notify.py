"""Local-notify settings / fired keys / trigger history prefs."""

from __future__ import annotations

import re
import time
from collections.abc import Mapping
from datetime import UTC
from typing import Any

from server.db.database import Database
from server.ui_prefs.common import (
    FIRED_RETAIN_AFTER_START_MS,
    KEY_NOTIFY_FIRED,
    KEY_NOTIFY_SETTINGS,
    KEY_NOTIFY_TRIGGER_HISTORY,
    MAX_NOTIFY_HISTORY_ENTRIES,
    UiPrefsValidationError,
    _read_json,
    _write_json,
)

_LEAD_OFFSET_MIN_MINUTES = 1
_LEAD_OFFSET_MAX_MINUTES = 7 * 24 * 60
_PREAMBLE_CHIME_IDS = frozenset(
    {
        "broadcast",
        "station",
        "westminster",
        "school",
        "airport",
        "store",
        "door-chime",
        "none",
    }
)
_TIME_RE = re.compile(r"^\d{2}:\d{2}$")

_FLASH_MODES = frozenset({"timed", "persistent"})
_DEFAULT_NOTIFY_SETTINGS: dict[str, Any] = {
    "enabled": False,
    "voiceEnabled": True,
    "flashEnabled": True,
    "flashMode": "timed",
    "leadOffsetsMinutes": [60],
    "preambleChimeId": "broadcast",
    "quietHours": {"enabled": True, "start": "22:00", "end": "07:00"},
}


def _sanitize_flash_mode(value: Any) -> str:
    if isinstance(value, str) and value in _FLASH_MODES:
        return value
    return str(_DEFAULT_NOTIFY_SETTINGS["flashMode"])


def _sanitize_bool(value: Any, default: bool) -> bool:
    return value if isinstance(value, bool) else default


def _sanitize_preamble_chime_id(value: Any) -> str:
    if isinstance(value, str) and value in _PREAMBLE_CHIME_IDS:
        return value
    return str(_DEFAULT_NOTIFY_SETTINGS["preambleChimeId"])


def sanitize_notify_settings(raw: Any) -> dict[str, Any]:
    """Align with web ``domain/notify/scanner/settings.ts`` normalize rules.

    Leftover ``sourceFilter`` in stored JSON is ignored (not read or written).
    """
    data = raw if isinstance(raw, Mapping) else {}
    lead_raw = data.get("leadOffsetsMinutes")
    leads: list[int] = []
    if isinstance(lead_raw, list):
        seen: set[int] = set()
        for item in lead_raw:
            if isinstance(item, bool) or not isinstance(item, (int, float)):
                continue
            if isinstance(item, float) and not item.is_integer():
                continue
            offset = int(item)
            if (
                _LEAD_OFFSET_MIN_MINUTES <= offset <= _LEAD_OFFSET_MAX_MINUTES
                and offset not in seen
            ):
                seen.add(offset)
        leads = sorted(seen)
    if not leads:
        leads = list(_DEFAULT_NOTIFY_SETTINGS["leadOffsetsMinutes"])

    quiet_raw = data.get("quietHours")
    quiet = quiet_raw if isinstance(quiet_raw, Mapping) else {}
    start = quiet.get("start")
    end = quiet.get("end")
    quiet_hours = {
        "enabled": (
            quiet["enabled"]
            if isinstance(quiet.get("enabled"), bool)
            else _DEFAULT_NOTIFY_SETTINGS["quietHours"]["enabled"]
        ),
        "start": start if isinstance(start, str) and _TIME_RE.match(start) else "22:00",
        "end": end if isinstance(end, str) and _TIME_RE.match(end) else "07:00",
    }

    return {
        "enabled": (data["enabled"] if isinstance(data.get("enabled"), bool) else _DEFAULT_NOTIFY_SETTINGS["enabled"]),
        "voiceEnabled": _sanitize_bool(data.get("voiceEnabled"), _DEFAULT_NOTIFY_SETTINGS["voiceEnabled"]),
        "flashEnabled": _sanitize_bool(data.get("flashEnabled"), _DEFAULT_NOTIFY_SETTINGS["flashEnabled"]),
        "flashMode": _sanitize_flash_mode(data.get("flashMode")),
        "leadOffsetsMinutes": leads,
        "preambleChimeId": _sanitize_preamble_chime_id(data.get("preambleChimeId")),
        "quietHours": quiet_hours,
    }


async def get_notify_settings(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_NOTIFY_SETTINGS)
    if raw is None:
        return {"configured": False, "settings": None}
    clean = sanitize_notify_settings(raw)
    return {"configured": True, "settings": clean}


async def put_notify_settings(db: Database, settings: Any) -> dict[str, Any]:
    clean = sanitize_notify_settings(settings)
    await _write_json(db, KEY_NOTIFY_SETTINGS, clean)
    return {"configured": True, "settings": clean}


def _parse_start_time_from_dedupe_key(key: str) -> str | None:
    """Dedupe key shape: ``{eventId}::{lead}::{startTime}`` (startTime may contain ``:``)."""
    first = key.find("::")
    if first < 0:
        return None
    second = key.find("::", first + 2)
    if second < 0:
        return None
    start_time = key[second + 2 :]
    return start_time or None


def sanitize_fired_keys(
    raw: Any,
    *,
    now_ms: float | None = None,
    prune: bool = True,
) -> list[str]:
    if not isinstance(raw, list):
        raise UiPrefsValidationError("fired keys must be an array of strings")
    keys: list[str] = []
    seen: set[str] = set()
    for item in raw:
        if isinstance(item, str) and item and item not in seen:
            seen.add(item)
            keys.append(item)
    if not prune:
        return keys
    clock = time.time() * 1000 if now_ms is None else now_ms
    kept: list[str] = []
    for key in keys:
        start_time = _parse_start_time_from_dedupe_key(key)
        if not start_time:
            continue
        try:
            # Accept ISO-8601; fromisoformat handles most client timestamps.
            start_ms = _iso_to_ms(start_time)
        except ValueError:
            continue
        if start_ms + FIRED_RETAIN_AFTER_START_MS >= clock:
            kept.append(key)
    return kept


def _iso_to_ms(value: str) -> float:
    from datetime import datetime

    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.timestamp() * 1000


async def get_notify_fired(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_NOTIFY_FIRED)
    if raw is None:
        return {"configured": False, "keys": None}
    if not isinstance(raw, list):
        return {"configured": False, "keys": None}
    return {"configured": True, "keys": sanitize_fired_keys(raw, prune=False)}


async def put_notify_fired(db: Database, keys: Any) -> dict[str, Any]:
    clean = sanitize_fired_keys(keys, prune=True)
    await _write_json(db, KEY_NOTIFY_FIRED, clean)
    return {"configured": True, "keys": clean}


async def claim_notify_fired(db: Database, keys: Any) -> dict[str, Any]:
    """Add dedupe keys not already stored; return ``claimed`` for this client to speak."""
    if not isinstance(keys, list):
        raise UiPrefsValidationError("fired keys must be an array of strings")
    raw = await _read_json(db, KEY_NOTIFY_FIRED)
    if raw is None or not isinstance(raw, list):
        current_list: list[str] = []
    else:
        current_list = sanitize_fired_keys(raw, prune=True)
    current_set = set(current_list)

    claimed: list[str] = []
    for item in keys:
        if not isinstance(item, str):
            continue
        key = item.strip()
        if not key or key in current_set:
            continue
        current_set.add(key)
        claimed.append(key)

    merged = sanitize_fired_keys(list(current_set), prune=True)
    await _write_json(db, KEY_NOTIFY_FIRED, merged)
    return {"configured": True, "claimed": claimed, "keys": merged}


def sanitize_notify_history(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        raise UiPrefsValidationError("history entries must be an array")
    entries: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        entry_id = item.get("id")
        reason = item.get("triggerReason")
        status = item.get("status")
        error = item.get("errorMessage")
        triggered_at = item.get("triggeredAt")
        if not isinstance(entry_id, str) or not entry_id:
            continue
        if not isinstance(reason, str):
            continue
        if status not in ("success", "failure"):
            continue
        if error is not None and not isinstance(error, str):
            continue
        if not isinstance(triggered_at, str) or not triggered_at:
            continue
        entry: dict[str, Any] = {
            "id": entry_id,
            "triggerReason": reason,
            "status": status,
            "errorMessage": error,
            "triggeredAt": triggered_at,
        }
        event_id = item.get("eventId")
        if isinstance(event_id, str) and event_id:
            entry["eventId"] = event_id
        title = item.get("title")
        if isinstance(title, str):
            entry["title"] = title
        lead = item.get("leadOffsetMinutes")
        if isinstance(lead, (int, float)) and not isinstance(lead, bool):
            entry["leadOffsetMinutes"] = int(lead)
        entries.append(entry)
        if len(entries) >= MAX_NOTIFY_HISTORY_ENTRIES:
            break
    return entries


async def get_notify_history(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_NOTIFY_TRIGGER_HISTORY)
    if raw is None:
        return {"configured": False, "entries": None}
    if not isinstance(raw, list):
        return {"configured": False, "entries": None}
    return {"configured": True, "entries": sanitize_notify_history(raw)}


async def put_notify_history(db: Database, entries: Any) -> dict[str, Any]:
    clean = sanitize_notify_history(entries)
    await _write_json(db, KEY_NOTIFY_TRIGGER_HISTORY, clean)
    return {"configured": True, "entries": clean}

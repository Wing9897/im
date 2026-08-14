"""Voice reminder settings / fired keys / trigger history prefs."""

from __future__ import annotations

import re
import time
from collections.abc import Mapping
from datetime import UTC
from typing import Any

from server.db.database import Database
from server.ui_prefs.common import (
    FIRED_RETAIN_AFTER_START_MS,
    KEY_VOICE_REMINDER_FIRED,
    KEY_VOICE_REMINDER_SETTINGS,
    KEY_VOICE_REMINDER_TRIGGER_HISTORY,
    MAX_VOICE_HISTORY_ENTRIES,
    SOURCE_FILTER_INVALID,
    UiPrefsValidationError,
    _read_json,
    _sanitize_source_filter_shape,
    _write_json,
)
from server.worksets_const import SYSTEM_WORKSET_ID

_LEAD_OFFSET_OPTIONS = frozenset({15, 60, 240, 1440})
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

_DEFAULT_SOURCE_FILTER: dict[str, list[str]] = {
    "taskIds": [],
    "worksetIds": [SYSTEM_WORKSET_ID],
}

_DEFAULT_VOICE_SETTINGS: dict[str, Any] = {
    "enabled": False,
    "leadOffsetsMinutes": [60],
    # Explicit default: builtin「一般」workset only (`null` = all sources).
    "sourceFilter": dict(_DEFAULT_SOURCE_FILTER),
    "preambleChimeId": "broadcast",
    "quietHours": {"enabled": True, "start": "22:00", "end": "07:00"},
}


def _sanitize_preamble_chime_id(value: Any) -> str:
    if isinstance(value, str) and value in _PREAMBLE_CHIME_IDS:
        return value
    return str(_DEFAULT_VOICE_SETTINGS["preambleChimeId"])


def _default_source_filter() -> dict[str, list[str]]:
    return {
        "taskIds": list(_DEFAULT_SOURCE_FILTER["taskIds"]),
        "worksetIds": list(_DEFAULT_SOURCE_FILTER["worksetIds"]),
    }


def _sanitize_source_filter(data: Mapping[str, Any]) -> dict[str, list[str]] | None:
    """Hard-cut: only ``sourceFilter: null | {taskIds, worksetIds}``.

    Missing / invalid → default ``__user__`` workset. Flat legacy ignored.
    """
    if "sourceFilter" not in data:
        return _default_source_filter()
    cleaned = _sanitize_source_filter_shape(data.get("sourceFilter"))
    if cleaned is SOURCE_FILTER_INVALID:
        return _default_source_filter()
    assert cleaned is None or isinstance(cleaned, dict)
    return cleaned


def sanitize_voice_settings(raw: Any) -> dict[str, Any]:
    """Align with web ``voiceReminder/settings.ts`` normalize rules."""
    data = raw if isinstance(raw, Mapping) else {}
    lead_raw = data.get("leadOffsetsMinutes")
    leads: list[int] = []
    if isinstance(lead_raw, list):
        seen: set[int] = set()
        for item in lead_raw:
            if isinstance(item, bool) or not isinstance(item, (int, float)):
                continue
            offset = int(item)
            if offset in _LEAD_OFFSET_OPTIONS and offset not in seen:
                seen.add(offset)
        # Preserve catalog order like the frontend.
        leads = [o for o in (15, 60, 240, 1440) if o in seen]
    if not leads:
        leads = list(_DEFAULT_VOICE_SETTINGS["leadOffsetsMinutes"])

    quiet_raw = data.get("quietHours")
    quiet = quiet_raw if isinstance(quiet_raw, Mapping) else {}
    start = quiet.get("start")
    end = quiet.get("end")
    quiet_hours = {
        "enabled": (
            quiet["enabled"]
            if isinstance(quiet.get("enabled"), bool)
            else _DEFAULT_VOICE_SETTINGS["quietHours"]["enabled"]
        ),
        "start": start if isinstance(start, str) and _TIME_RE.match(start) else "22:00",
        "end": end if isinstance(end, str) and _TIME_RE.match(end) else "07:00",
    }

    return {
        "enabled": (data["enabled"] if isinstance(data.get("enabled"), bool) else _DEFAULT_VOICE_SETTINGS["enabled"]),
        "leadOffsetsMinutes": leads,
        "sourceFilter": _sanitize_source_filter(data),
        "preambleChimeId": _sanitize_preamble_chime_id(data.get("preambleChimeId")),
        "quietHours": quiet_hours,
    }


async def get_voice_settings(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_VOICE_REMINDER_SETTINGS)
    if raw is None:
        return {"configured": False, "settings": None}
    clean = sanitize_voice_settings(raw)
    return {"configured": True, "settings": clean}


async def put_voice_settings(db: Database, settings: Any) -> dict[str, Any]:
    clean = sanitize_voice_settings(settings)
    await _write_json(db, KEY_VOICE_REMINDER_SETTINGS, clean)
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


async def get_voice_fired(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_VOICE_REMINDER_FIRED)
    if raw is None:
        return {"configured": False, "keys": None}
    if not isinstance(raw, list):
        return {"configured": False, "keys": None}
    return {"configured": True, "keys": sanitize_fired_keys(raw, prune=False)}


async def put_voice_fired(db: Database, keys: Any) -> dict[str, Any]:
    clean = sanitize_fired_keys(keys, prune=True)
    await _write_json(db, KEY_VOICE_REMINDER_FIRED, clean)
    return {"configured": True, "keys": clean}


async def claim_voice_fired(db: Database, keys: Any) -> dict[str, Any]:
    """Add dedupe keys not already stored; return ``claimed`` for this client to speak."""
    if not isinstance(keys, list):
        raise UiPrefsValidationError("fired keys must be an array of strings")
    raw = await _read_json(db, KEY_VOICE_REMINDER_FIRED)
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
    await _write_json(db, KEY_VOICE_REMINDER_FIRED, merged)
    return {"configured": True, "claimed": claimed, "keys": merged}


def sanitize_voice_history(raw: Any) -> list[dict[str, Any]]:
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
        if len(entries) >= MAX_VOICE_HISTORY_ENTRIES:
            break
    return entries


async def get_voice_history(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_VOICE_REMINDER_TRIGGER_HISTORY)
    if raw is None:
        return {"configured": False, "entries": None}
    if not isinstance(raw, list):
        return {"configured": False, "entries": None}
    return {"configured": True, "entries": sanitize_voice_history(raw)}


async def put_voice_history(db: Database, entries: Any) -> dict[str, Any]:
    clean = sanitize_voice_history(entries)
    await _write_json(db, KEY_VOICE_REMINDER_TRIGGER_HISTORY, clean)
    return {"configured": True, "entries": clean}

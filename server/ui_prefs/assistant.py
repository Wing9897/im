"""Assistant chat sessions + voice IO prefs."""

from __future__ import annotations

import json
from typing import Any, Mapping

from server.db.database import Database
from server.ui_prefs.common import (
    KEY_ASSISTANT_VOICE_IO,
    MAX_ASSISTANT_MESSAGE_CONTENT_CHARS,
    MAX_ASSISTANT_SESSIONS,
    MAX_ASSISTANT_SESSIONS_JSON_CHARS,
    UiPrefsValidationError,
    _encode_json,
    _read_json,
    _write_json,
)
from server.util import utc_now_iso
from server.worksets_const import SYSTEM_WORKSET_ID

_STT_PROVIDERS = frozenset({"browser", "whisper", "doubao"})
_TTS_PROVIDERS = frozenset({"browser", "doubao"})
_SPACE_PTT_MODES = frozenset({"hold", "toggle"})
_DEFAULT_VOICE_IO: dict[str, Any] = {
    "sttProvider": "browser",
    "ttsProvider": "browser",
    "ttsEnabled": True,
    "speechLanguage": "zh-HK",
    "spacePttMode": "hold",
    "ttsVoiceUri": "",
    # Default create target for assistant chat / pure-voice (system workset).
    "defaultWorksetId": SYSTEM_WORKSET_ID,
}


def _sanitize_tool_calls(raw: Any) -> list[dict[str, Any]] | None:
    if not isinstance(raw, list) or not raw:
        return None
    calls: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        entry: dict[str, Any] = {"name": name.strip()}
        summary = item.get("resultSummary")
        if isinstance(summary, str):
            entry["resultSummary"] = summary[:2000]
        calls.append(entry)
        if len(calls) >= 40:
            break
    return calls or None


def sanitize_assistant_sessions_payload(raw: Any) -> dict[str, Any]:
    """``{ sessions: [...], activeSessionId: string|null }``; max 50 sessions."""
    data = raw if isinstance(raw, Mapping) else {}
    sessions_raw = data.get("sessions")
    if not isinstance(sessions_raw, list):
        raise UiPrefsValidationError("sessions must be an array")

    sessions: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for item in sessions_raw:
        if not isinstance(item, Mapping):
            continue
        session_id = item.get("id")
        title = item.get("title")
        updated_at = item.get("updatedAt")
        messages_raw = item.get("messages")
        if not isinstance(session_id, str) or not session_id.strip():
            continue
        if session_id in seen_ids:
            continue
        if not isinstance(title, str):
            continue
        if isinstance(updated_at, bool) or not isinstance(updated_at, (int, float)):
            continue
        if not isinstance(messages_raw, list):
            continue
        messages: list[dict[str, Any]] = []
        for msg in messages_raw:
            if not isinstance(msg, Mapping):
                continue
            msg_id = msg.get("id")
            role = msg.get("role")
            content = msg.get("content")
            if not isinstance(msg_id, str) or not msg_id:
                continue
            if role not in ("user", "assistant"):
                continue
            if not isinstance(content, str):
                continue
            if len(content) > MAX_ASSISTANT_MESSAGE_CONTENT_CHARS:
                content = content[: MAX_ASSISTANT_MESSAGE_CONTENT_CHARS - 1] + "…"
            entry: dict[str, Any] = {
                "id": msg_id,
                "role": role,
                "content": content,
            }
            tool_calls = _sanitize_tool_calls(msg.get("toolCalls"))
            if tool_calls is not None:
                entry["toolCalls"] = tool_calls
            messages.append(entry)
        clean: dict[str, Any] = {
            "id": session_id.strip(),
            "title": title[:200],
            "updatedAt": int(updated_at),
            "messages": messages,
        }
        server_session = item.get("sessionId")
        if isinstance(server_session, str) and server_session.strip():
            clean["sessionId"] = server_session.strip()
        seen_ids.add(clean["id"])
        sessions.append(clean)
        if len(sessions) >= MAX_ASSISTANT_SESSIONS:
            break

    sessions.sort(key=lambda s: s["updatedAt"], reverse=True)
    sessions = sessions[:MAX_ASSISTANT_SESSIONS]

    active = data.get("activeSessionId")
    if active is not None and not isinstance(active, str):
        raise UiPrefsValidationError("activeSessionId must be a string or null")
    active_id = active.strip() if isinstance(active, str) and active.strip() else None
    if active_id is not None and active_id not in seen_ids:
        active_id = None

    return {"sessions": sessions, "activeSessionId": active_id}


def _normalize_device_id(device_id: Any) -> str:
    if not isinstance(device_id, str):
        raise UiPrefsValidationError("deviceId must be a non-empty string")
    trimmed = device_id.strip()
    if not trimmed or len(trimmed) > 128:
        raise UiPrefsValidationError("deviceId must be a non-empty string")
    return trimmed


def _empty_device_response() -> dict[str, Any]:
    return {"configured": False, "sessions": None, "activeSessionId": None}


async def get_assistant_sessions(db: Database, device_id: str) -> dict[str, Any]:
    did = _normalize_device_id(device_id)
    row = await db.fetch_one(
        "SELECT payload_json FROM assistant_device_stores WHERE device_id = ?",
        (did,),
    )
    if row is None:
        return _empty_device_response()
    try:
        raw = json.loads(str(row["payload_json"]))
    except json.JSONDecodeError:
        return _empty_device_response()
    if not isinstance(raw, dict):
        return _empty_device_response()
    try:
        clean = sanitize_assistant_sessions_payload(raw)
    except UiPrefsValidationError:
        return _empty_device_response()
    return {"configured": True, **clean}


async def put_assistant_sessions(db: Database, device_id: str, payload: Any) -> dict[str, Any]:
    did = _normalize_device_id(device_id)
    clean = sanitize_assistant_sessions_payload(payload)
    encoded = _encode_json(clean, max_chars=MAX_ASSISTANT_SESSIONS_JSON_CHARS)
    await db.execute(
        """
        INSERT INTO assistant_device_stores (device_id, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        """,
        (did, encoded, utc_now_iso()),
    )
    return {"configured": True, **clean}


def _sanitize_tts_voice_uri(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    trimmed = value.strip()
    if not trimmed:
        return ""
    return trimmed[:512]


def _sanitize_default_workset_id(value: Any) -> str:
    """Empty / missing → system workset; otherwise trimmed workset id (max 128)."""
    if not isinstance(value, str):
        return str(_DEFAULT_VOICE_IO["defaultWorksetId"])
    trimmed = value.strip()
    if not trimmed or trimmed == SYSTEM_WORKSET_ID:
        return SYSTEM_WORKSET_ID
    return trimmed[:128]


def sanitize_assistant_voice_io(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, Mapping) else {}
    stt = data.get("sttProvider")
    tts = data.get("ttsProvider")
    lang = data.get("speechLanguage")
    ptt = data.get("spacePttMode")
    return {
        "sttProvider": stt if stt in _STT_PROVIDERS else _DEFAULT_VOICE_IO["sttProvider"],
        "ttsProvider": tts if tts in _TTS_PROVIDERS else _DEFAULT_VOICE_IO["ttsProvider"],
        "ttsEnabled": (
            data["ttsEnabled"] if isinstance(data.get("ttsEnabled"), bool) else _DEFAULT_VOICE_IO["ttsEnabled"]
        ),
        "speechLanguage": (
            lang.strip() if isinstance(lang, str) and lang.strip() else _DEFAULT_VOICE_IO["speechLanguage"]
        ),
        "spacePttMode": ptt if ptt in _SPACE_PTT_MODES else _DEFAULT_VOICE_IO["spacePttMode"],
        "ttsVoiceUri": _sanitize_tts_voice_uri(data.get("ttsVoiceUri")),
        "defaultWorksetId": _sanitize_default_workset_id(data.get("defaultWorksetId")),
    }


async def get_assistant_voice_io(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_ASSISTANT_VOICE_IO)
    if raw is None:
        return {"configured": False, "settings": None}
    return {"configured": True, "settings": sanitize_assistant_voice_io(raw)}


async def put_assistant_voice_io(db: Database, settings: Any) -> dict[str, Any]:
    clean = sanitize_assistant_voice_io(settings)
    await _write_json(db, KEY_ASSISTANT_VOICE_IO, clean)
    return {"configured": True, "settings": clean}

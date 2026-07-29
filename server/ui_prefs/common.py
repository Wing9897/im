"""Shared keys, caps, JSON helpers for UI prefs."""

from __future__ import annotations

import json
from typing import Any, Optional

from server.db.database import Database
from server.util import utc_now_iso

#: ``ui_prefs.key`` values (formerly ``system_config``; retired from CONFIG_DEFAULTS in v15).
KEY_OPS_BOARD_LAYOUT = "ops_board_layout"
KEY_OPS_BOARD_WIDGET_STATE = "ops_board_widget_state"
KEY_VOICE_REMINDER_SETTINGS = "voice_reminder_settings"
KEY_VOICE_REMINDER_FIRED = "voice_reminder_fired"
KEY_VOICE_REMINDER_TRIGGER_HISTORY = "voice_reminder_trigger_history"
KEY_ASSISTANT_VOICE_IO = "assistant_voice_io_settings"
KEY_TIMELINE_ANNOTATIONS = "timeline_annotations"

UI_PREF_KEYS = frozenset(
    {
        KEY_OPS_BOARD_LAYOUT,
        KEY_OPS_BOARD_WIDGET_STATE,
        KEY_VOICE_REMINDER_SETTINGS,
        KEY_VOICE_REMINDER_FIRED,
        KEY_VOICE_REMINDER_TRIGGER_HISTORY,
        KEY_ASSISTANT_VOICE_IO,
        KEY_TIMELINE_ANNOTATIONS,
    }
)

#: Per-key serialized JSON size cap (~hundreds of KB; matches avatar order).
MAX_PREF_JSON_CHARS = 512 * 1024
#: Chat history blobs can be larger (≤50 sessions with tool summaries).
MAX_ASSISTANT_SESSIONS_JSON_CHARS = 2 * 1024 * 1024
MAX_ASSISTANT_SESSIONS = 50
MAX_ASSISTANT_MESSAGE_CONTENT_CHARS = 20_000

#: Align with web ``triggerHistory`` MAX_ENTRIES.
MAX_VOICE_HISTORY_ENTRIES = 100

#: Align with web ``scanner`` FIRED_RETAIN_AFTER_START_MS (2 days).
FIRED_RETAIN_AFTER_START_MS = 2 * 24 * 60 * 60 * 1000


class UiPrefsValidationError(ValueError):
    """Invalid or oversized UI-pref payload."""


def _encode_json(value: Any, *, max_chars: int = MAX_PREF_JSON_CHARS) -> str:
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(encoded) > max_chars:
        raise UiPrefsValidationError(f"Payload exceeds {max_chars} character limit")
    return encoded


async def _read_json(db: Database, key: str) -> Optional[Any]:
    row = await db.fetch_one("SELECT payload_json FROM ui_prefs WHERE key = ?", (key,))
    if row is None:
        return None
    raw = str(row["payload_json"] or "").strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Corrupt row → treat as unset so clients can rewrite.
        return None


async def _write_json(db: Database, key: str, value: Any, *, max_chars: int = MAX_PREF_JSON_CHARS) -> None:
    await db.execute(
        """
        INSERT INTO ui_prefs (key, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        """,
        (key, _encode_json(value, max_chars=max_chars), utc_now_iso()),
    )


async def _delete_json(db: Database, key: str) -> None:
    await db.execute("DELETE FROM ui_prefs WHERE key = ?", (key,))

"""SQLite-backed UI prefs (ops board + local notify + assistant + timeline).

Global and per-device prefs are JSON TEXT rows in ``ui_prefs``. Static keys are
listed in ``UI_PREF_KEYS``; assistant sessions use ``assistant_sessions:<device>``.
Empty / missing means "no server data" (clients seed defaults or empty lists;
no localStorage migrate into server). Not exposed on the Settings wire map —
use ``/api/v1/ui-prefs/*``.
"""

from __future__ import annotations

from server.ui_prefs.assistant import (
    get_assistant_sessions,
    get_assistant_voice_io,
    put_assistant_sessions,
    put_assistant_voice_io,
    sanitize_assistant_sessions_payload,
    sanitize_assistant_voice_io,
)
from server.ui_prefs.board import (
    get_board_prefs,
    put_board_prefs,
    sanitize_board_layout,
    sanitize_board_widget_state,
)
from server.ui_prefs.common import (
    FIRED_RETAIN_AFTER_START_MS,
    KEY_ASSISTANT_VOICE_IO,
    KEY_OPS_BOARD_LAYOUT,
    KEY_OPS_BOARD_WIDGET_STATE,
    KEY_TIMELINE_ANNOTATIONS,
    KEY_NOTIFY_FIRED,
    KEY_NOTIFY_SETTINGS,
    KEY_NOTIFY_TRIGGER_HISTORY,
    MAX_ASSISTANT_MESSAGE_CONTENT_CHARS,
    MAX_ASSISTANT_SESSIONS,
    MAX_ASSISTANT_SESSIONS_JSON_CHARS,
    MAX_PREF_JSON_CHARS,
    MAX_VOICE_HISTORY_ENTRIES,
    UI_PREF_KEYS,
    UiPrefsValidationError,
)
from server.ui_prefs.timeline import (
    MAX_TIMELINE_ANNOTATION_ENTRIES,
    get_timeline_annotations,
    put_timeline_annotations,
    sanitize_timeline_annotations,
)
from server.ui_prefs.notify import (
    claim_voice_fired,
    get_voice_fired,
    get_voice_history,
    get_voice_settings,
    put_voice_fired,
    put_voice_history,
    put_voice_settings,
    sanitize_fired_keys,
    sanitize_voice_history,
    sanitize_voice_settings,
)

__all__ = [
    "FIRED_RETAIN_AFTER_START_MS",
    "KEY_ASSISTANT_VOICE_IO",
    "KEY_OPS_BOARD_LAYOUT",
    "KEY_OPS_BOARD_WIDGET_STATE",
    "KEY_TIMELINE_ANNOTATIONS",
    "KEY_NOTIFY_FIRED",
    "KEY_NOTIFY_SETTINGS",
    "KEY_NOTIFY_TRIGGER_HISTORY",
    "MAX_ASSISTANT_MESSAGE_CONTENT_CHARS",
    "MAX_ASSISTANT_SESSIONS",
    "MAX_ASSISTANT_SESSIONS_JSON_CHARS",
    "MAX_PREF_JSON_CHARS",
    "MAX_TIMELINE_ANNOTATION_ENTRIES",
    "MAX_VOICE_HISTORY_ENTRIES",
    "UI_PREF_KEYS",
    "UiPrefsValidationError",
    "claim_voice_fired",
    "get_assistant_sessions",
    "get_assistant_voice_io",
    "get_board_prefs",
    "get_timeline_annotations",
    "get_voice_fired",
    "get_voice_history",
    "get_voice_settings",
    "put_assistant_sessions",
    "put_assistant_voice_io",
    "put_board_prefs",
    "put_timeline_annotations",
    "put_voice_fired",
    "put_voice_history",
    "put_voice_settings",
    "sanitize_assistant_sessions_payload",
    "sanitize_assistant_voice_io",
    "sanitize_board_layout",
    "sanitize_board_widget_state",
    "sanitize_fired_keys",
    "sanitize_timeline_annotations",
    "sanitize_voice_history",
    "sanitize_voice_settings",
]

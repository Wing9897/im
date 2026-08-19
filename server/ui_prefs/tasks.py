"""Task card emoji map (analysis task ids) in ``ui_prefs``.

Stored under ``task_emojis`` so we do **not** add ``analysis_tasks.emoji`` or
bump the wipe-only schema stamp. Same unification as ``schedule_emojis``.
Empty glyph / missing id → clients show the default task logo (not the AI head).
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from server.db.database import Database
from server.ui_prefs.common import (
    KEY_TASK_EMOJIS,
    _read_json,
    _write_json,
)

#: Cap map size so a runaway client cannot fill ui_prefs.
MAX_TASK_EMOJI_ENTRIES = 5_000
#: ZWJ sequences can be long; keep a hard cap rather than a grapheme parser.
MAX_TASK_EMOJI_CHARS = 32
MAX_TASK_EMOJI_KEY_CHARS = 160


def sanitize_task_emojis(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, Mapping) else {}
    emojis_raw = data.get("emojis")
    emojis: dict[str, str] = {}
    if isinstance(emojis_raw, Mapping):
        for key, value in emojis_raw.items():
            if not isinstance(key, str):
                continue
            clean_key = key.strip()
            if not clean_key or len(clean_key) > MAX_TASK_EMOJI_KEY_CHARS:
                continue
            if any(ch.isspace() for ch in clean_key):
                continue
            if not isinstance(value, str):
                continue
            glyph = value.strip()
            if not glyph or len(glyph) > MAX_TASK_EMOJI_CHARS:
                continue
            emojis[clean_key] = glyph
            if len(emojis) >= MAX_TASK_EMOJI_ENTRIES:
                break
    return {"emojis": emojis}


async def get_task_emojis(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_TASK_EMOJIS)
    if raw is None:
        return {"configured": False, "emojis": None}
    clean = sanitize_task_emojis(raw)
    return {"configured": True, **clean}


async def put_task_emojis(db: Database, payload: Any) -> dict[str, Any]:
    clean = sanitize_task_emojis(payload)
    await _write_json(db, KEY_TASK_EMOJIS, clean)
    return {"configured": True, **clean}

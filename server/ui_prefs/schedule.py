"""Schedule card emoji map (one-off / recurring ids) in ``ui_prefs``."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from server.db.database import Database
from server.ui_prefs.common import (
    KEY_SCHEDULE_EMOJIS,
    _read_json,
    _write_json,
)

#: Cap map size so a runaway client cannot fill ui_prefs.
MAX_SCHEDULE_EMOJI_ENTRIES = 5_000
#: ZWJ sequences can be long; keep a hard cap rather than a grapheme parser.
MAX_SCHEDULE_EMOJI_CHARS = 32
MAX_SCHEDULE_EMOJI_KEY_CHARS = 160


def sanitize_schedule_emojis(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, Mapping) else {}
    emojis_raw = data.get("emojis")
    emojis: dict[str, str] = {}
    if isinstance(emojis_raw, Mapping):
        for key, value in emojis_raw.items():
            if not isinstance(key, str):
                continue
            clean_key = key.strip()
            if not clean_key or len(clean_key) > MAX_SCHEDULE_EMOJI_KEY_CHARS:
                continue
            if any(ch.isspace() for ch in clean_key):
                continue
            if not isinstance(value, str):
                continue
            glyph = value.strip()
            if not glyph or len(glyph) > MAX_SCHEDULE_EMOJI_CHARS:
                continue
            emojis[clean_key] = glyph
            if len(emojis) >= MAX_SCHEDULE_EMOJI_ENTRIES:
                break
    return {"emojis": emojis}


async def get_schedule_emojis(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_SCHEDULE_EMOJIS)
    if raw is None:
        return {"configured": False, "emojis": None}
    clean = sanitize_schedule_emojis(raw)
    return {"configured": True, **clean}


async def put_schedule_emojis(db: Database, payload: Any) -> dict[str, Any]:
    clean = sanitize_schedule_emojis(payload)
    await _write_json(db, KEY_SCHEDULE_EMOJIS, clean)
    return {"configured": True, **clean}

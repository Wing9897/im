"""Built-in **task template catalog** loaded from ``shared/task_presets.json``.

``BUILTIN_PRESETS`` is a curated list of ready-to-use analysis task presets
(e.g. "trending topics") that a user can apply when creating a task. Each
preset carries display text (``name`` / ``description`` / ``promptTemplate``)
plus structural fields (``id`` / ``analysisMode`` / ``defaultAnalysisTimeRange``
/ ``badge``).

This is **not** :mod:`server.prompts` — that package holds versioned
system/schema prompt strings. This module is a static, user-facing catalog
served over ``GET /api/v1/tasks/templates``.

**Display-text source of truth**: the zh-Hant UI locale
(``web/src/i18n/locales/zh-Hant/tasks.json`` → ``presets.<id>``).
The Chinese strings here are the API **fallback** (zh-Hant slice of the shared
JSON). Sync locales with ``uv run python scripts/sync_task_presets.py``;
``server/tests/test_task_preset_i18n_parity.py`` guards against drift.
"""

from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

_DISPLAY_LOCALE = "zh-Hant"


def _source_path() -> Path:
    # PyInstaller onedir: datas land under sys._MEIPASS (…/_internal).
    meipass = getattr(sys, "_MEIPASS", None)
    if getattr(sys, "frozen", False) and meipass:
        return Path(meipass) / "task_presets.json"
    # server/presets/task_presets.py → repo root / shared /
    return Path(__file__).resolve().parents[2] / "shared" / "task_presets.json"


def _flatten_entry(entry: dict[str, Any]) -> dict[str, Any]:
    zh = entry["i18n"][_DISPLAY_LOCALE]
    flat: dict[str, Any] = {
        "id": entry["id"],
        "name": zh["name"],
        "description": zh["description"],
        "analysisMode": entry["analysisMode"],
        "promptTemplate": zh["promptTemplate"],
        "defaultAnalysisTimeRange": entry["defaultAnalysisTimeRange"],
        "badge": entry["badge"],
    }
    return flat


@lru_cache(maxsize=1)
def load_builtin_presets() -> tuple[dict[str, Any], ...]:
    path = _source_path()
    if not path.is_file():
        raise RuntimeError(f"Missing task presets catalog at {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise RuntimeError(f"{path}: expected non-empty JSON array")
    return tuple(_flatten_entry(entry) for entry in data)


def get_builtin_presets() -> list[dict[str, Any]]:
    """Mutable list copy for API responses (callers may not mutate the cache)."""
    return [dict(item) for item in load_builtin_presets()]


# Eager load so import-time failures surface at startup (same as former module constant).
BUILTIN_PRESETS: list[dict[str, Any]] = get_builtin_presets()

__all__ = [
    "BUILTIN_PRESETS",
    "get_builtin_presets",
    "load_builtin_presets",
]

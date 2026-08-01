"""Parity guard: shared JSON catalog vs zh-Hant ``tasks.presets`` (display SoT).

Display text source of truth is the zh-Hant UI locale; ``BUILTIN_PRESETS``
(loaded from ``shared/task_presets.json``) is the API fallback
(see docs/I18N-GLOSSARY.md#任務模板-presets顯示文案-sot).
This test fails if either side drifts — fix with
``uv run python scripts/sync_task_presets.py``.
"""

from __future__ import annotations

import json
from pathlib import Path

from server.presets.task_presets import BUILTIN_PRESETS

_REPO_ROOT = Path(__file__).resolve().parents[2]
_LOCALE_PATH = _REPO_ROOT / "web" / "src" / "i18n" / "locales" / "zh-Hant" / "common.json"
_SHARED_PATH = _REPO_ROOT / "shared" / "task_presets.json"

_SYNCED_FIELDS = ("name", "description", "promptTemplate")


def _load_locale_presets() -> dict[str, dict[str, str]]:
    data = json.loads(_LOCALE_PATH.read_text(encoding="utf-8"))
    return data["tasks"]["presets"]


def test_task_preset_ids_match_locale():
    locale_presets = _load_locale_presets()
    catalog_ids = {preset["id"] for preset in BUILTIN_PRESETS}
    assert catalog_ids == set(locale_presets), (
        "BUILTIN_PRESETS ids must exactly match zh-Hant tasks.presets ids; "
        "run scripts/sync_task_presets.py after adding/removing a preset on either side."
    )


def test_task_preset_display_text_matches_locale_source_of_truth():
    locale_presets = _load_locale_presets()
    for preset in BUILTIN_PRESETS:
        locale_entry = locale_presets[preset["id"]]
        for field in _SYNCED_FIELDS:
            assert preset[field] == locale_entry[field], (
                f"BUILTIN_PRESETS[{preset['id']!r}].{field} drifted from zh-Hant "
                f"tasks.presets.{preset['id']}.{field}; "
                "run `uv run python scripts/sync_task_presets.py`."
            )


def test_builtin_presets_load_from_shared_json():
    assert _SHARED_PATH.is_file()
    raw = json.loads(_SHARED_PATH.read_text(encoding="utf-8"))
    assert len(BUILTIN_PRESETS) == len(raw)
    assert BUILTIN_PRESETS[0]["id"] == raw[0]["id"]

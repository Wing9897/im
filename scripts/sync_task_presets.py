"""Sync locale task-preset copy from ``shared/task_presets.json``.

Single source of truth for builtin task templates. This script writes:

- ``web/src/i18n/locales/{zh-Hant,en,zh-Hans}/common.json`` → ``tasks.presets.*``

The API catalog is loaded at runtime from ``shared/task_presets.json``
(see :mod:`server.presets.task_presets`); no generated Python catalog.

Usage::

    uv run python scripts/sync_task_presets.py           # write fixes (if any)
    uv run python scripts/sync_task_presets.py --check    # CI: fail on drift, no write

See ``docs/I18N-GLOSSARY.md`` and ``docs/ARCHITECTURE.md``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = REPO_ROOT / "shared" / "task_presets.json"
LOCALE_ROOT = REPO_ROOT / "web" / "src" / "i18n" / "locales"
LOCALES = ("zh-Hant", "en", "zh-Hans")
I18N_FIELDS = ("name", "description", "promptTemplate")


def _load_source() -> list[dict[str, Any]]:
    data = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise SystemExit(f"{SOURCE_PATH}: expected non-empty JSON array")
    return data


def _build_locale_presets(source: list[dict[str, Any]], locale: str) -> dict[str, dict[str, str]]:
    return {entry["id"]: {field: entry["i18n"][locale][field] for field in I18N_FIELDS} for entry in source}


def _write_locale(locale: str, presets: dict[str, dict[str, str]]) -> bool:
    path = LOCALE_ROOT / locale / "common.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    existing = data.get("tasks", {}).get("presets")
    if existing == presets:
        return False
    data.setdefault("tasks", {})["presets"] = presets
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if generated artifacts drift; never write.",
    )
    args = parser.parse_args(argv)

    source = _load_source()
    locale_maps = {locale: _build_locale_presets(source, locale) for locale in LOCALES}

    drift = False
    for locale in LOCALES:
        path = LOCALE_ROOT / locale / "common.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("tasks", {}).get("presets") != locale_maps[locale]:
            drift = True

    if not drift:
        print(f"Already in sync: locale presets match {SOURCE_PATH.relative_to(REPO_ROOT)}.")
        return 0

    if args.check:
        print(
            f"Task preset locales drift from {SOURCE_PATH.relative_to(REPO_ROOT)}; "
            "run `uv run python scripts/sync_task_presets.py` to fix.",
            file=sys.stderr,
        )
        return 1

    wrote_locales = [_write_locale(locale, locale_maps[locale]) for locale in LOCALES]
    for locale, changed in zip(LOCALES, wrote_locales, strict=True):
        if changed:
            print(f"Updated {LOCALE_ROOT.relative_to(REPO_ROOT)}/{locale}/common.json")
    print(f"Synced {len(source)} preset(s) from {SOURCE_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

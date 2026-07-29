"""Generate task preset artifacts from ``shared/task_presets.json``.

Single source of truth for builtin task templates. This script writes:

- ``server/api/routes/task_preset_data.py`` → ``BUILTIN_PRESETS`` (zh-Hant text fallback)
- ``web/src/i18n/locales/{zh-Hant,en,zh-Hans}/common.json`` → ``tasks.presets.*``

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
CATALOG_PATH = REPO_ROOT / "server" / "api" / "routes" / "task_preset_data.py"
LOCALE_ROOT = REPO_ROOT / "web" / "src" / "i18n" / "locales"
LOCALES = ("zh-Hant", "en", "zh-Hans")
DISPLAY_LOCALE = "zh-Hant"
I18N_FIELDS = ("name", "description", "promptTemplate")
_KEY_ORDER = (
    "id",
    "name",
    "description",
    "analysisMode",
    "promptTemplate",
    "defaultAnalysisTimeRange",
    "badge",
)
_LIST_MARKER = "BUILTIN_PRESETS: list[dict[str, Any]] = ["


def _load_source() -> list[dict[str, Any]]:
    data = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise SystemExit(f"{SOURCE_PATH}: expected non-empty JSON array")
    return data


def _render_preset(preset: dict[str, Any]) -> str:
    lines = ["    {"]
    for key in _KEY_ORDER:
        if key not in preset:
            continue
        lines.append(f'        "{key}": {json.dumps(preset[key], ensure_ascii=False)},')
    lines.append("    },")
    return "\n".join(lines)


def _render_presets_list(presets: list[dict[str, Any]]) -> str:
    body = "\n".join(_render_preset(p) for p in presets)
    return f"[\n{body}\n]"


def _build_catalog_presets(source: list[dict[str, Any]]) -> list[dict[str, Any]]:
    catalog: list[dict[str, Any]] = []
    for entry in source:
        zh = entry["i18n"][DISPLAY_LOCALE]
        catalog.append(
            {
                "id": entry["id"],
                "name": zh["name"],
                "description": zh["description"],
                "analysisMode": entry["analysisMode"],
                "promptTemplate": zh["promptTemplate"],
                "defaultAnalysisTimeRange": entry["defaultAnalysisTimeRange"],
                "badge": entry["badge"],
            }
        )
    return catalog


def _build_locale_presets(source: list[dict[str, Any]], locale: str) -> dict[str, dict[str, str]]:
    return {entry["id"]: {field: entry["i18n"][locale][field] for field in I18N_FIELDS} for entry in source}


def _extract_builtin_presets(source: str) -> tuple[list[dict[str, Any]], int, int]:
    try:
        marker_start = source.index(_LIST_MARKER)
    except ValueError as exc:
        raise SystemExit(f"{CATALOG_PATH}: could not find BUILTIN_PRESETS assignment") from exc
    list_start = marker_start + len(_LIST_MARKER) - 1
    depth = 0
    list_end = None
    for i in range(list_start, len(source)):
        ch = source[i]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                list_end = i + 1
                break
    if list_end is None:
        raise SystemExit(f"{CATALOG_PATH}: unterminated BUILTIN_PRESETS list literal")
    literal = source[list_start:list_end]
    presets = json.loads(json.dumps(__import__("ast").literal_eval(literal)))
    return presets, list_start, list_end


def _write_catalog(presets: list[dict[str, Any]]) -> bool:
    source = CATALOG_PATH.read_text(encoding="utf-8")
    current, list_start, list_end = _extract_builtin_presets(source)
    if current == presets:
        return False
    new_source = source[:list_start] + _render_presets_list(presets) + source[list_end:]
    CATALOG_PATH.write_text(new_source, encoding="utf-8", newline="\n")
    return True


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
    catalog = _build_catalog_presets(source)
    locale_maps = {locale: _build_locale_presets(source, locale) for locale in LOCALES}

    drift = False
    if _extract_builtin_presets(CATALOG_PATH.read_text(encoding="utf-8"))[0] != catalog:
        drift = True
    for locale in LOCALES:
        path = LOCALE_ROOT / locale / "common.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("tasks", {}).get("presets") != locale_maps[locale]:
            drift = True

    if not drift:
        print(f"Already in sync: artifacts match {SOURCE_PATH.relative_to(REPO_ROOT)}.")
        return 0

    if args.check:
        print(
            f"Task preset artifacts drift from {SOURCE_PATH.relative_to(REPO_ROOT)}; "
            "run `uv run python scripts/sync_task_presets.py` to fix.",
            file=sys.stderr,
        )
        return 1

    wrote_catalog = _write_catalog(catalog)
    wrote_locales = [_write_locale(locale, locale_maps[locale]) for locale in LOCALES]
    if wrote_catalog:
        print(f"Updated {CATALOG_PATH.relative_to(REPO_ROOT)}")
    for locale, changed in zip(LOCALES, wrote_locales, strict=True):
        if changed:
            print(f"Updated {LOCALE_ROOT.relative_to(REPO_ROOT)}/{locale}/common.json")
    print(f"Synced {len(source)} preset(s) from {SOURCE_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

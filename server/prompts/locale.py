"""UI locale helpers for AI output-language directives.

Append a short directive to existing system prompts; do not translate the
full prompt. Supported tokens match the web ``AppLocale`` set.
"""

from __future__ import annotations

UI_LOCALES = frozenset({"zh-Hant", "zh-Hans", "en"})
DEFAULT_UI_LOCALE = "zh-Hant"

_OUTPUT_LANGUAGE_DIRECTIVES: dict[str, str] = {
    "zh-Hant": "Write all user-facing text in Traditional Chinese (繁體中文).",
    "zh-Hans": "Write all user-facing text in Simplified Chinese (简体中文).",
    "en": "Write all user-facing text in English.",
}


def normalize_ui_locale(value: str | None) -> str:
    """Return a supported UI locale; unknown / empty → ``zh-Hant``."""
    raw = (value or "").strip()
    if raw in UI_LOCALES:
        return raw
    return DEFAULT_UI_LOCALE


def output_language_directive(locale: str | None) -> str:
    """Short output-language instruction appended to system prompts."""
    normalized = normalize_ui_locale(locale)
    return _OUTPUT_LANGUAGE_DIRECTIVES[normalized]

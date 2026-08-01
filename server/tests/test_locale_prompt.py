"""UI locale normalization and output-language directives."""

from __future__ import annotations

from server.prompts.locale import (
    DEFAULT_UI_LOCALE,
    normalize_ui_locale,
    output_language_directive,
)


def test_normalize_ui_locale_accepts_supported_tokens() -> None:
    assert normalize_ui_locale("zh-Hant") == "zh-Hant"
    assert normalize_ui_locale("zh-Hans") == "zh-Hans"
    assert normalize_ui_locale("en") == "en"


def test_normalize_ui_locale_falls_back_for_unknown() -> None:
    assert normalize_ui_locale(None) == DEFAULT_UI_LOCALE
    assert normalize_ui_locale("") == DEFAULT_UI_LOCALE
    assert normalize_ui_locale("fr") == DEFAULT_UI_LOCALE
    assert normalize_ui_locale("  zh-TW  ") == DEFAULT_UI_LOCALE


def test_normalize_ui_locale_rejects_auto() -> None:
    """Server ui_locale is concrete-only; client preference ``auto`` must not persist."""
    assert normalize_ui_locale("auto") == DEFAULT_UI_LOCALE
    assert normalize_ui_locale("Auto") == DEFAULT_UI_LOCALE


def test_output_language_directive_en() -> None:
    text = output_language_directive("en")
    assert "English" in text
    assert text.startswith("Write all user-facing text")


def test_output_language_directive_zh_variants() -> None:
    assert "Traditional Chinese" in output_language_directive("zh-Hant")
    assert "Simplified Chinese" in output_language_directive("zh-Hans")
    assert "Traditional Chinese" in output_language_directive("bogus")

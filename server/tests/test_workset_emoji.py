"""Workset emoji grapheme helper (stamp 3 card glyph)."""

from server.domain.emoji import EmojiValidationError, grapheme_count, normalize_single_grapheme_emoji


def test_grapheme_count_empty_and_simple() -> None:
    assert grapheme_count("") == 0
    assert grapheme_count("🎯") == 1
    assert grapheme_count("AB") == 2
    assert grapheme_count("😀😀") == 2


def test_grapheme_count_zwj_family() -> None:
    family = "👨‍👩‍👧‍👦"
    assert grapheme_count(family) == 1
    assert normalize_single_grapheme_emoji(family) == family


def test_normalize_single_grapheme_trims_and_allows_empty() -> None:
    assert normalize_single_grapheme_emoji("  📚  ") == "📚"
    assert normalize_single_grapheme_emoji("") == ""
    assert normalize_single_grapheme_emoji(None) == ""


def test_normalize_single_grapheme_rejects_multi() -> None:
    try:
        normalize_single_grapheme_emoji("ab")
    except EmojiValidationError as exc:
        assert "single grapheme" in str(exc)
    else:
        raise AssertionError("expected EmojiValidationError")

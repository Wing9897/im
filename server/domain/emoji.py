"""Optional short glyph stored on tasks / calendars / items / worksets."""

from __future__ import annotations

import unicodedata
from typing import Any

#: Optional emoji / short logo (grapheme cluster may be multi-codepoint).
EMOJI_MAX = 16

_ZWJ = "\u200d"
_COMBINING_CATS = frozenset({"Mn", "Mc", "Me"})
_VS_MIN, _VS_MAX = 0xFE00, 0xFE0F
_VS_SUP_MIN, _VS_SUP_MAX = 0xE0100, 0xE01EF
_RI_MIN, _RI_MAX = 0x1F1E6, 0x1F1FF
_TAG_MIN, _TAG_MAX = 0xE0020, 0xE007F
_KEYCAP = "\u20e3"
_SKIN_TONE_MIN, _SKIN_TONE_MAX = 0x1F3FB, 0x1F3FF


class EmojiValidationError(ValueError):
    """Invalid optional emoji payload."""


def _is_grapheme_extender(ch: str) -> bool:
    code = ord(ch)
    if unicodedata.category(ch) in _COMBINING_CATS:
        return True
    if ch in {_ZWJ, _KEYCAP}:
        return True
    if _VS_MIN <= code <= _VS_MAX or _VS_SUP_MIN <= code <= _VS_SUP_MAX:
        return True
    if _TAG_MIN <= code <= _TAG_MAX:
        return True
    return _SKIN_TONE_MIN <= code <= _SKIN_TONE_MAX


def grapheme_count(text: str) -> int:
    """Count extended grapheme clusters (ZWJ sequences, flags, skin tones)."""
    if not text:
        return 0
    count = 0
    index = 0
    length = len(text)
    while index < length:
        count += 1
        code = ord(text[index])
        index += 1
        if _RI_MIN <= code <= _RI_MAX and index < length and _RI_MIN <= ord(text[index]) <= _RI_MAX:
            index += 1
        while index < length:
            ch = text[index]
            if ch == _ZWJ:
                index += 1
                if index < length:
                    index += 1
                continue
            if _is_grapheme_extender(ch):
                index += 1
                continue
            break
    return count


def normalize_optional_emoji(value: Any) -> str | None:
    """Strip empty to NULL; reject oversized strings."""
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    if len(cleaned) > EMOJI_MAX:
        raise EmojiValidationError(f"emoji must be <= {EMOJI_MAX} characters")
    return cleaned


def normalize_single_grapheme_emoji(value: Any) -> str:
    """Empty string or exactly one grapheme cluster (workset card glyph)."""
    if value is None:
        return ""
    cleaned = str(value).strip()
    if not cleaned:
        return ""
    if len(cleaned) > EMOJI_MAX:
        raise EmojiValidationError(f"emoji must be <= {EMOJI_MAX} characters")
    if grapheme_count(cleaned) != 1:
        raise EmojiValidationError("emoji must be a single grapheme or empty")
    return cleaned


def emoji_from_row(row: Any, key: str = "emoji") -> str | None:
    raw = row.get(key) if hasattr(row, "get") else None
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None

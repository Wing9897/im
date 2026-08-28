"""Optional short glyph stored on tasks / calendars / items."""

from __future__ import annotations

from typing import Any

#: Optional emoji / short logo (grapheme cluster may be multi-codepoint).
EMOJI_MAX = 16


class EmojiValidationError(ValueError):
    """Invalid optional emoji payload."""


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


def emoji_from_row(row: Any, key: str = "emoji") -> str | None:
    raw = row.get(key) if hasattr(row, "get") else None
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None
